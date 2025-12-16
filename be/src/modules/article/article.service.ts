import { Injectable, InternalServerErrorException, Logger, BadRequestException, NotFoundException, MessageEvent } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, isValidObjectId } from 'mongoose';
import { CrawlRequestDto, ArticleResponseDto, CrawlTriggerResponseDto } from './dto/crawl-request';
import { SearchHistoryResponseDto } from './dto/search-history';
import { Article, ArticleDocument } from './schemas/article.schema';
import { SearchHistory, SearchHistoryDocument } from './schemas/search-history.schema';
import { Website, WebsiteDocument } from './schemas/website.schema';
import { WebsiteResponseDto } from './dto/website.response.dto';
import { firstValueFrom, Observable } from 'rxjs';
import { PaginationParamsDto, PaginatedArticleResponse } from './dto/pagination.dto';
import * as ExcelJS from 'exceljs';
import { Buffer } from 'buffer';
import { SearchResponseDto } from './dto/search-response.dto';
import { MeiliSearchService } from '../common/meilisearch/meilisearch.service';
import { SystemLogService } from '../common/SystemLog/system-loc.service';

interface CrawlApiResponse {
    status: string; // 'completed' | 'processing'
    search_id: string;
    stream_url?: string;
    meta: {
        total_available_now?: number;
        page?: number;
        page_size?: number;
        [key: string]: any;
    };
    instruction?: string;
}

export interface CrawlStatusResponse {
    search_id: string;
    status: string;
    total_saved: number;
    updated_at: string | null;
}

@Injectable()
export class ArticleService {
    private readonly logger = new Logger(ArticleService.name);
    private readonly crawlApiUrl = 'http://127.0.0.1:8000/crawl';

    constructor(
        @InjectModel(Article.name) private articleModel: Model<ArticleDocument>,
        @InjectModel(SearchHistory.name) private searchHistoryModel: Model<SearchHistoryDocument>,
        @InjectModel(Website.name) private websiteModel: Model<WebsiteDocument>,
        private readonly httpService: HttpService,
        private readonly meiliService: MeiliSearchService,
        private readonly systemLogService: SystemLogService,
    ) {}

    async triggerCrawlManual(crawlDto: CrawlRequestDto): Promise<CrawlTriggerResponseDto> {
        try {
            const payload = {
                ...crawlDto,
            };

            const response = await firstValueFrom(
                this.httpService.post<CrawlApiResponse>(this.crawlApiUrl, payload)
            );
            const data = response.data;

            await this.systemLogService.createLog('CRAWL_TRIGGERED_SSE', 'INFO', { 
                searchId: data.search_id, 
                status: data.status 
            }, crawlDto.user_id);

            return {
                status: data.status,
                search_id: data.search_id,
                stream_url: `/article/stream-status/${data.search_id}`,
                meta: data.meta
            };

        } catch (error) {
            this.logger.error('Error triggering crawl manual', error);
            throw new InternalServerErrorException('Lỗi khi gọi service Crawl Python');
        }
    }

    subscribeToCrawlStatus(searchId: string): Observable<MessageEvent> {
        return new Observable((observer) => {
            const pythonStreamUrl = `${this.crawlApiUrl}/stream-status/${searchId}`;
            this.logger.debug(`Connecting to Python Stream: ${pythonStreamUrl}`);

            const controller = new AbortController();

            this.httpService.axiosRef({
                method: 'get',
                url: pythonStreamUrl,
                responseType: 'stream',
                signal: controller.signal
            }).then((response) => {
                const stream = response.data;
                let buffer = '';

                stream.on('data', (chunk: Buffer) => {
                    buffer += chunk.toString(); 
                    
                    const lines = buffer.split('\n');
                    
                    buffer = lines.pop() || ''; 

                    let currentEvent = 'message';
                    let currentData = null;

                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (!trimmedLine) continue;

                        if (trimmedLine.startsWith('event:')) {
                            currentEvent = trimmedLine.replace('event:', '').trim();
                        } else if (trimmedLine.startsWith('data:')) {
                            const rawData = trimmedLine.replace('data:', '').trim();
                            try {
                                currentData = JSON.parse(rawData);
                            } catch (e) {
                                currentData = rawData;
                            }

                            if (currentData) {
                                observer.next({
                                    type: currentEvent,
                                    data: currentData
                                } as MessageEvent);

                                if (currentEvent === 'end') {
                                    this.logger.debug(`Stream finished for ${searchId}`);
                                    observer.complete();
                                }
                                
                                currentEvent = 'message'; 
                                currentData = null;
                            }
                        }
                    }
                });

                stream.on('end', () => {
                    observer.complete();
                });

                stream.on('error', (err) => {
                    this.logger.error(`Stream error for ${searchId}`, err.message);
                    observer.error(err);
                });

            }).catch((err) => {
                this.logger.error(`Failed to connect to Python stream for ${searchId}: ${err.message}`);
                observer.error(err);
            });

            return () => {
                this.logger.debug(`Client disconnected from stream ${searchId}`);
                controller.abort();
            };
        });
    }

    async searchAndFetchArticles(crawlDto: CrawlRequestDto, pagination: PaginationParamsDto): Promise<SearchResponseDto> {
        const trigger = await this.triggerCrawlManual(crawlDto);
        return { 
            newHistoryItem: null, 
            results: { data: [], total: 0, page: 1, limit: 10, totalPages: 0 } 
        }; 
    }

    async getCrawlStatus(searchId: string): Promise<CrawlStatusResponse> {
        try {
            const url = `${this.crawlApiUrl}/status/${searchId}`;
            const response = await firstValueFrom(this.httpService.get<CrawlStatusResponse>(url));
            return response.data;
        } catch (error) {
            this.logger.error(`Error checking status for ${searchId}`, error);
            throw new InternalServerErrorException('Không thể kiểm tra trạng thái crawl');
        }
    }

    async getArticlesBySearchId(searchId: string, pagination: PaginationParamsDto): Promise<PaginatedArticleResponse> {
        const page = Number(pagination.page) || 1;
        const limit = Number(pagination.limit) || 10;
        const skip = (page - 1) * limit;

        const pipeline: PipelineStage[] = [
            { $match: { search_id: searchId } },

            {
                $group: {
                    _id: "$url",
                    doc: { $first: "$$ROOT" }
                }
            },

            { $replaceRoot: { newRoot: "$doc" } },

            { $sort: { publish_date: -1 as const, _id: -1 as const } }, 

            {
                $facet: {
                    metadata: [{ $count: "total" }],
                    data: [{ $skip: skip }, { $limit: limit }]
                }
            }
        ];

        const [result] = await this.articleModel.aggregate(pipeline).exec();
        
        const total = result.metadata[0]?.total || 0;
        const articles = result.data || [];
        const totalPages = Math.ceil(total / limit);

        const data = articles.map(article => ({
            id: article._id.toString(),
            title: article.title,
            summary: article.summary,
            website: article.website,
            publish_date: article.publish_date,
            url: article.url,
            ai_sentiment_score: (article.ai_sentiment_score !== undefined && article.ai_sentiment_score !== null) ? Number(article.ai_sentiment_score) : null,
            ai_summary: article.ai_summary || [],
            site_categories: article.site_categories || [],
        }));

        return { data, total, page, limit, totalPages };
    }

    async getSearchHistoryByUserId(userId: string): Promise<SearchHistoryResponseDto[]> {
        const history = await this.searchHistoryModel
            .find({ user_id: userId })
            .sort({ _id: -1 })
            .limit(10)
            .exec();
        return history.map(item => ({ ...item.toJSON(), _id: item._id.toString() } as SearchHistoryResponseDto));
    }

    async getArticleDetailById(identifier: string): Promise<Article> {
        const conditions: any[] = [{ article_id: identifier }];
        
        if (isValidObjectId(identifier)) {
            conditions.push({ _id: identifier });
        }

        const article = await this.articleModel.findOne({ $or: conditions }).exec();

        if (!article) {
            throw new NotFoundException(`Không tìm thấy bài viết với ID: ${identifier}`);
        }
        return article.toObject();
    }

    async getAllWebsites(): Promise<WebsiteResponseDto[]> {
        const websites = await this.websiteModel.find().exec();
        return websites.map(s => ({ _id: s._id.toString(), name: s.name, displayName: s.displayName }));
    }

    async exportBySearchId(searchId: string): Promise<Buffer> {
        const articles = await this.articleModel
            .find({ search_id: searchId })
            .sort({ publish_date: -1, _id: -1 }) 
            .exec();

        if (!articles.length) throw new NotFoundException('Không tìm thấy dữ liệu để export.');
        return this.generateExcelBuffer(articles);
    }

    async exportSelectedArticles(articleIds: string[]): Promise<Buffer> {
        const articles = await this.articleModel.find({ _id: { $in: articleIds } }).sort({ publish_date: -1 }).exec();
        if (!articles.length) throw new NotFoundException('Không tìm thấy bài báo nào hợp lệ.');
        return this.generateExcelBuffer(articles);
    }

    private async generateExcelBuffer(articles: ArticleDocument[]): Promise<Buffer> {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'ArticleService';
        workbook.created = new Date();
        const worksheet = workbook.addWorksheet('Articles');
        worksheet.columns = [
            { header: 'Tiêu đề', key: 'title', width: 50 },
            { header: 'Tóm tắt', key: 'summary', width: 70 },
            { header: 'Nội dung', key: 'content', width: 100 },
            { header: 'Website', key: 'website', width: 20 },
            { header: 'Ngày xuất bản', key: 'publish_date', width: 20 },
            { header: 'URL', key: 'url', width: 60 },
            { header: 'Cảm xúc (Score)', key: 'ai_sentiment_score', width: 15 },
        ];
        worksheet.addRows(articles.map(a => ({
            title: a.title, 
            summary: a.summary, 
            content: a.content, 
            website: a.website, 
            publish_date: a.publish_date, 
            url: a.url, 
            ai_sentiment_score: (a.ai_sentiment_score !== undefined && a.ai_sentiment_score !== null) ? Number(a.ai_sentiment_score) : 0
        })));
        const arrayBuffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(arrayBuffer);
    }
}