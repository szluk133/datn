import { Injectable, InternalServerErrorException, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CrawlRequestDto, ArticleResponseDto } from './dto/crawl-request';
import { SearchHistoryResponseDto } from './dto/search-history';
import { Article, ArticleDocument } from './schemas/article.schema';
import { SearchHistory, SearchHistoryDocument } from './schemas/search-history.schema';
import { Website, WebsiteDocument } from './schemas/website.schema';
import { WebsiteResponseDto } from './dto/website.response.dto';
import { firstValueFrom } from 'rxjs';
import { PaginationParamsDto, PaginatedArticleResponse } from './dto/pagination.dto';
import * as ExcelJS from 'exceljs';
import { Buffer } from 'buffer';
import { SearchResponseDto } from './dto/search-response.dto';
import { MeiliSearchService } from '../common/meilisearch/meilisearch.service';
import { SystemLogService } from '../common/SystemLog/system-loc.service';

interface CrawlApiResponse {
  status: string; // 'completed' | 'processing'
  search_id: string;
  meta: {
    total_available_now: number;
    page: number;
    page_size: number;
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

  async searchAndFetchArticles(crawlDto: CrawlRequestDto, pagination: PaginationParamsDto): Promise<SearchResponseDto> {
    let searchId: string;
    let crawlResponse: CrawlApiResponse;

    const page = Number(pagination.page) || 1;
    const pageSize = Number(pagination.limit) || 10;

    const payload = {
        ...crawlDto,
        page: page,
        page_size: pageSize
    };

    this.logger.log(`[DEBUG] Payload gửi đến Python API: ${JSON.stringify(payload)}`);

    try {
      const response = await firstValueFrom(
        this.httpService.post<CrawlApiResponse>(this.crawlApiUrl, payload),
      );
      crawlResponse = response.data;
      
      if (!crawlResponse.search_id) {
        await this.systemLogService.createLog('CRAWL_FAILED', 'ERROR', { message: 'No search_id returned', dto: crawlDto }, crawlDto.user_id);
        throw new BadRequestException('Lỗi từ dịch vụ crawl: Không nhận được search_id');
      }

      searchId = crawlResponse.search_id;
      const totalAvailable = crawlResponse.meta?.total_available_now || 0;
      
      this.logger.log(`Crawl triggered. Status: ${crawlResponse.status}, Search ID: ${searchId}, Available: ${totalAvailable}`);
      
      await this.systemLogService.createLog('CRAWL_TRIGGERED', 'INFO', { 
          searchId: searchId, 
          status: crawlResponse.status,
          total_available: totalAvailable, 
          websites: crawlDto.websites 
      }, crawlDto.user_id);

    } catch (error) {
      this.logger.error('Error in crawl flow.', error.stack);
      if (error instanceof BadRequestException) {
          throw error;
      }
      await this.systemLogService.createLog('CRAWL_SYSTEM_ERROR', 'ERROR', { error: error.message }, crawlDto.user_id);
      throw new InternalServerErrorException('Lỗi quy trình crawl.');
    }

    const articleResults: PaginatedArticleResponse = await this.getArticlesBySearchId(searchId, pagination);

    if (crawlResponse.meta?.total_available_now > 0 && articleResults.total === 0) {
        this.logger.warn(`API báo có ${crawlResponse.meta.total_available_now} items nhưng MongoDB chưa thấy (SearchID: ${searchId}). Có thể do độ trễ ghi.`);
    }

    const newHistoryItem = await this.fetchNewHistoryItem(searchId);
    
    return { newHistoryItem, results: articleResults };
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

  private async fetchNewHistoryItem(searchId: string): Promise<SearchHistoryResponseDto | null> {
      const historyDoc = await this.searchHistoryModel.findOne({ search_id: searchId }).exec();
      if (!historyDoc) return null;
      const obj = historyDoc.toJSON();
      return { ...obj, _id: obj._id.toString() } as SearchHistoryResponseDto;
  }

  async searchArticlesInMeili(keyword: string, pagination: PaginationParamsDto, filters: string[] = []): Promise<PaginatedArticleResponse> {
    const page = Number(pagination.page) || 1;
    const limit = Number(pagination.limit) || 10;
    const result = await this.meiliService.search(keyword, {
        page, limit, filter: filters.length > 0 ? filters.join(' AND ') : undefined, sort: ['publish_date:desc']
    });

    const total = result.estimatedTotalHits || result.hits.length;
    const totalPages = Math.ceil(total / limit);
    
    const data: ArticleResponseDto[] = result.hits.map((hit: any) => {
        let sentiment = null;
        if (hit.ai_sentiment_score !== undefined && hit.ai_sentiment_score !== null) {
            const parsed = Number(hit.ai_sentiment_score);
            if (!isNaN(parsed)) {
                sentiment = parsed;
            }
        }

        return {
            id: hit.id || hit.article_id,
            title: hit.title,
            summary: hit.summary,
            website: hit.website,
            publish_date: hit.publish_date,
            url: hit.url,
            
            ai_sentiment_score: sentiment,

            ai_summary: Array.isArray(hit.ai_summary) ? hit.ai_summary : [], 
            site_categories: Array.isArray(hit.site_categories) ? hit.site_categories : []
        };
    });

    return { data, total, page, limit, totalPages };
  }

  async getArticlesBySearchId(searchId: string, pagination: PaginationParamsDto): Promise<PaginatedArticleResponse> {
      const page = Number(pagination.page) || 1;
      const limit = Number(pagination.limit) || 10;
      const skip = (page - 1) * limit;
      const query = { search_id: searchId };
      const total = await this.articleModel.countDocuments(query);
      const articles = await this.articleModel.find(query).sort({ publish_date: -1 }).skip(skip).limit(limit).exec();
      const totalPages = Math.ceil(total / limit);
      const data = articles.map(article => article.toJSON() as ArticleResponseDto);
      return { data, total, page, limit, totalPages };
  }

  async getSearchHistoryByUserId(userId: string): Promise<SearchHistoryResponseDto[]> {
    // Đổi createdAt: -1 thành _id: -1
    const history = await this.searchHistoryModel
        .find({ user_id: userId })
        .sort({ _id: -1 }) // <--- SỬA Ở ĐÂY: Lấy mới nhất dựa trên ID
        .limit(10)
        .exec();
    return history.map(item => ({ ...item.toJSON(), _id: item._id.toString() } as SearchHistoryResponseDto));
  }
  async getArticleDetailById(articleId: string): Promise<Article> {
      const article = await this.articleModel.findById(articleId).exec();
      if (!article) throw new NotFoundException();
      return article.toObject();
  }
  async getAllWebsites(): Promise<WebsiteResponseDto[]> {
      const websites = await this.websiteModel.find().exec();
      return websites.map(s => ({ _id: s._id.toString(), name: s.name, displayName: s.displayName }));
  }
  async exportBySearchId(searchId: string): Promise<Buffer> {
      await this.systemLogService.createLog('EXPORT_ALL', 'INFO', { searchId }, 'unknown_user');
      const articles = await this.articleModel.find({ search_id: searchId }).sort({ publish_date: -1 }).exec();
      if (!articles.length) throw new NotFoundException('Không tìm thấy dữ liệu để export.');
      return this.generateExcelBuffer(articles);
  }
  async exportSelectedArticles(articleIds: string[]): Promise<Buffer> {
      await this.systemLogService.createLog('EXPORT_SELECTED', 'INFO', { count: articleIds.length }, 'unknown_user');
      const articles = await this.articleModel.find({ _id: { $in: articleIds } }).sort({ publish_date: -1 }).exec();
      if (!articles.length) throw new NotFoundException('Không tìm thấy bài báo nào hợp lệ trong danh sách ID cung cấp.');
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