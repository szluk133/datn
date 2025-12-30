import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { MyArticle, MyArticleDocument } from '@/modules/my-article/schemas/my-article.schema';
import { MyArticleUpdate, MyArticleUpdateDocument } from '@/modules/my-article/schemas/my-article-update.schema';
import { 
    CreateMyArticleDto, 
    ImportMyArticlesDto, 
    EnrichMyArticlesDto,
    GetMyArticlesDto,
    ExportMyArticlesDto,
    GetUpdateHistoryDto // Import DTO mới
} from '@/modules/my-article/dto/create-my-article.dto';
import * as ExcelJS from 'exceljs';
import { v5 as uuidv5, v4 as uuidv4 } from 'uuid';
import { Response } from 'express';

@Injectable()
export class MyArticleService {
    private readonly logger = new Logger(MyArticleService.name);
    private readonly UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; 
    private readonly CRAWLER_SERVICE_URL = 'http://127.0.0.1:8000/my-articles/enrich';

    constructor(
        @InjectModel(MyArticle.name) private myArticleModel: Model<MyArticleDocument>,
        @InjectModel(MyArticleUpdate.name) private myArticleUpdateModel: Model<MyArticleUpdateDocument>,
        private readonly httpService: HttpService,
    ) {}

    // Helper: Lưu thông tin đợt Update
    private async saveUpdateBatch(updateId: string, userId: string) {
        try {
            await this.myArticleUpdateModel.updateOne(
                { update_id: updateId },
                { 
                    $setOnInsert: { 
                        update_id: updateId,
                        user_id: userId
                    }
                },
                { upsert: true }
            );
        } catch (error) {
            this.logger.error(`Failed to save update batch info: ${error.message}`);
        }
    }

    // 1. Tạo bài viết thủ công
    async createMyArticle(createDto: CreateMyArticleDto): Promise<MyArticle> {
        const articleId = uuidv5(createDto.content, this.UUID_NAMESPACE);
        const updateId = createDto.update_id || uuidv4();

        await this.saveUpdateBatch(updateId, createDto.user_id);

        const newArticle = new this.myArticleModel({
            article_id: articleId,
            content: createDto.content,
            title: createDto.title || '',
            website: createDto.website || '',
            publish_date: createDto.publish_date || new Date().toISOString(),
            search_id: 'my_page',
            user_id: createDto.user_id,
            update_id: updateId,
        });

        return await newArticle.save();
    }

    // 2. Import từ Excel
    async importMyArticlesFromExcel(file: Express.Multer.File, importDto: ImportMyArticlesDto): Promise<{ success: number, failed: number, errors: any[], update_id: string }> {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(file.buffer as any);

        const worksheet = workbook.getWorksheet(1);
        if (!worksheet) {
            throw new BadRequestException('File Excel không hợp lệ hoặc không có dữ liệu');
        }

        const articlesToInsert: Partial<MyArticle>[] = [];
        const errors: any[] = [];
        let successCount = 0;
        const currentUpdateId = importDto.update_id || uuidv4();

        await this.saveUpdateBatch(currentUpdateId, importDto.user_id);

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;

            const getCellValue = (cellIndex: number) => {
                const cell = row.getCell(cellIndex);
                return cell.text ? cell.text.trim() : ''; 
            };

            const title = getCellValue(1);
            const content = getCellValue(2);
            const website = getCellValue(3);
            const publishDateRaw = getCellValue(4);

            if (!content) {
                errors.push({ row: rowNumber, error: 'Content is required' });
                return;
            }

            const articleId = uuidv5(content, this.UUID_NAMESPACE);
            const publishDate = publishDateRaw || new Date().toISOString();

            articlesToInsert.push({
                article_id: articleId,
                content: content,
                title: title || '',
                website: website || '',
                publish_date: publishDate,
                search_id: 'my_page',
                user_id: importDto.user_id,
                update_id: currentUpdateId,
            });
        });

        for (const article of articlesToInsert) {
            try {
                await this.myArticleModel.updateOne(
                    { article_id: article.article_id, user_id: importDto.user_id },
                    { $set: article },
                    { upsert: true }
                );
                successCount++;
            } catch (err) {
                this.logger.error(`Import error: ${err.message}`);
                errors.push({ article_id: article.article_id, error: err.message });
            }
        }

        return {
            success: successCount,
            failed: errors.length,
            errors: errors,
            update_id: currentUpdateId
        };
    }

    // 3. Trigger Xử lý AI (Enrich)
    async enrichArticles(dto: EnrichMyArticlesDto) {
        this.logger.log(`Triggering AI Enrich for User: ${dto.user_id}, Batch: ${dto.update_id}`);

        try {
            const payload = {
                user_id: dto.user_id,
                update_id: dto.update_id
            };

            const response = await firstValueFrom(
                this.httpService.post(this.CRAWLER_SERVICE_URL, payload)
            );

            return response.data;

        } catch (error) {
            this.logger.error(`Error connecting to Crawler Service: ${error.message}`);
            if (error.response) {
                throw new BadRequestException(error.response.data?.message || 'Lỗi từ phía dịch vụ AI');
            }
            throw new BadRequestException('Không thể kết nối tới dịch vụ xử lý AI (Crawler)');
        }
    }

    // 4. Lấy danh sách bài báo
    async getMyArticles(dto: GetMyArticlesDto) {
        const { user_id, page = 1, limit = 10, update_id } = dto;
        const skip = (page - 1) * limit;

        const filter: any = { user_id };
        if (update_id) {
            filter.update_id = update_id;
        }

        const [data, total] = await Promise.all([
            this.myArticleModel.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .exec(),
            this.myArticleModel.countDocuments(filter)
        ]);

        return {
            data,
            meta: {
                total,
                page,
                limit,
                total_pages: Math.ceil(total / limit)
            }
        };
    }

    // [MỚI] 6. Lấy lịch sử cập nhật (Batch History)
    async getUpdateHistory(dto: GetUpdateHistoryDto) {
        const { user_id, page = 1, limit = 10 } = dto;
        const skip = (page - 1) * limit;
        const filter = { user_id };

        const [data, total] = await Promise.all([
            this.myArticleUpdateModel.find(filter)
                // 'created_at' là field do timestamps tự sinh (đã config ở schema bước trước)
                .sort({ created_at: -1 }) 
                .skip(skip)
                .limit(limit)
                .exec(),
            this.myArticleUpdateModel.countDocuments(filter)
        ]);

        return {
            data,
            meta: {
                total,
                page,
                limit,
                total_pages: Math.ceil(total / limit)
            }
        };
    }

    // 5. Export Excel
    async exportArticles(dto: ExportMyArticlesDto, res: Response) {
        const filter: any = { user_id: dto.user_id };

        if (dto.type === 'single' && dto.id) {
            filter.article_id = dto.id;
        } else if (dto.type === 'batch' && dto.id) {
            filter.update_id = dto.id;
        } else if (dto.type === 'list' && dto.ids) {
            const idList = dto.ids.split(',').map(id => id.trim());
            filter.article_id = { $in: idList };
        } else if (dto.type === 'batch' && !dto.id) {
             throw new BadRequestException('Vui lòng cung cấp update_id cho loại export batch');
        }

        const articles = await this.myArticleModel.find(filter).sort({ createdAt: -1 }).exec();

        if (!articles.length) {
            throw new NotFoundException('Không tìm thấy dữ liệu để xuất Excel');
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('My Articles');

        worksheet.columns = [
            { header: 'ID', key: 'article_id', width: 30 },
            { header: 'Title', key: 'title', width: 30 },
            { header: 'Content', key: 'content', width: 50 },
            { header: 'Website', key: 'website', width: 25 },
            { header: 'Publish Date', key: 'publish_date', width: 20 },
            { header: 'Sentiment', key: 'ai_sentiment_label', width: 15 },
            { header: 'Score', key: 'ai_sentiment_score', width: 10 },
            { header: 'Summary', key: 'ai_summary', width: 50 },
        ];

        articles.forEach(art => {
            worksheet.addRow({
                article_id: art.article_id,
                title: art.title,
                content: art.content,
                website: art.website,
                publish_date: art.publish_date,
                ai_sentiment_label: art.ai_sentiment_label,
                ai_sentiment_score: art.ai_sentiment_score,
                ai_summary: art.ai_summary ? art.ai_summary.join('\n') : ''
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=articles_export_${Date.now()}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    }
}