import { Injectable, Logger, InternalServerErrorException, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Article, ArticleDocument } from '../article/schemas/article.schema';
import { SearchHistory, SearchHistoryDocument } from '../article/schemas/search-history.schema';
import { Topic, TopicDocument } from './schemas/topic.schemas';
import { SystemLogService } from '../common/SystemLog/system-loc.service';
import { AdminSearchArticleDto, ArticleStatus } from './dto/admin.dto';
import { MeiliSearchService } from '../common/meilisearch/meilisearch.service';
import { QdrantService } from '../common/qdrant/qdrant.service';
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private readonly pythonApiUrl = 'http://127.0.0.1:8000';

  constructor(
    @InjectModel(Article.name) private articleModel: Model<ArticleDocument>,
    @InjectModel(SearchHistory.name) private historyModel: Model<SearchHistoryDocument>,
    @InjectModel(Topic.name) private topicModel: Model<TopicDocument>,
    private readonly systemLogService: SystemLogService,
    private readonly httpService: HttpService,
    private readonly meiliService: MeiliSearchService,
    private readonly qdrantService: QdrantService,
  ) {}


  async getDashboardStats() {
    const totalArticles = await this.articleModel.countDocuments();
    
    const topSources = await this.articleModel.aggregate([
      { $group: { _id: '$website', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    const sentimentStats = await this.articleModel.aggregate([
        { 
            $group: { 
                _id: null, 
                avgSentiment: { $avg: '$ai_sentiment_score' },
                positive: { $sum: { $cond: [{ $gt: ['$ai_sentiment_score', 0.2] }, 1, 0] } },
                negative: { $sum: { $cond: [{ $lt: ['$ai_sentiment_score', -0.2] }, 1, 0] } }
            } 
        }
    ]);

    return {
      totalArticles,
      topSources,
      sentiment: sentimentStats[0] || {},
      crawledToday: await this.countCrawledToday()
    };
  }

  async getLogs(limit: number) {
    return this.systemLogService.getLogs(limit);
  }

  private async countCrawledToday() {
    const startOfDay = new Date();
    startOfDay.setHours(0,0,0,0);
    return this.articleModel.countDocuments({ createdAt: { $gte: startOfDay } });
  }

  // 1. Cập nhật lịch trình Crawl
  async updateCrawlSchedule(minutes: number) {
    const url = `${this.pythonApiUrl}/admin/schedule`;
    this.logger.log(`Updating crawl schedule to every ${minutes} minutes...`);

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, { minutes })
      );

      await this.systemLogService.createLog(
        'UPDATE_SCHEDULE', 
        'INFO', 
        { minutes, response: response.data }, 
        'admin'
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to update schedule', error.message);
      await this.systemLogService.createLog('UPDATE_SCHEDULE_FAILED', 'ERROR', { error: error.message }, 'admin');
      throw new InternalServerErrorException('Không thể cập nhật lịch trình bên Python Service.');
    }
  }

  // 2. Kích hoạt Auto Crawl ngay lập tức
  async triggerAutoCrawl() {
    const url = `${this.pythonApiUrl}/admin/trigger-auto-crawl`;
    this.logger.log(`Triggering manual auto-crawl...`);

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, {})
      );

      await this.systemLogService.createLog(
        'TRIGGER_AUTO_CRAWL', 
        'INFO', 
        { response: response.data }, 
        'admin'
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to trigger auto crawl', error.message);
      await this.systemLogService.createLog('TRIGGER_AUTO_CRAWL_FAILED', 'ERROR', { error: error.message }, 'admin');
      throw new InternalServerErrorException('Không thể kích hoạt Auto Crawl.');
    }
  }

  async searchArticles(dto: AdminSearchArticleDto) {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const offset = (page - 1) * limit;
    const filterArray: string[] = [];

    if (dto.website) filterArray.push(`website = "${dto.website}"`);
    if (dto.status) filterArray.push(`status = "${dto.status}"`);
    if (dto.topic) filterArray.push(`site_categories = "${dto.topic}"`);

    if (dto.startDate) {
        const startTs = new Date(dto.startDate).getTime();
        filterArray.push(`publish_date >= ${startTs}`);
    }
    if (dto.endDate) {
        const endTs = new Date(dto.endDate).setHours(23, 59, 59, 999);
        filterArray.push(`publish_date <= ${endTs}`);
    }

    if (dto.minSentiment !== undefined) filterArray.push(`ai_sentiment_score >= ${dto.minSentiment}`);
    if (dto.maxSentiment !== undefined) filterArray.push(`ai_sentiment_score <= ${dto.maxSentiment}`);

    let sort = ['publish_date:desc'];
    
    if (dto.sort && dto.sort.length > 0) {
        sort = dto.sort;
    }

    const query = dto.q || '';

    try {

      const result = await this.meiliService.search(query, {
        limit, 
        offset, 
        filter: filterArray.join(' AND '), 
        sort: sort, 
        showMatchesPosition: true,
        attributesToRetrieve: ['article_id', 'title', 'url', 'site_categories', 'ai_sentiment_score', 'status', 'publish_date', 'website', 'summary']
      });

      return {
        data: result.hits.map(hit => ({ ...hit, publish_date_iso: new Date(hit.publish_date).toISOString() })),
        total: result.estimatedTotalHits || result.hits.length,
        page, limit, totalPages: Math.ceil((result.estimatedTotalHits || result.hits.length) / limit),
        processingTimeMs: result.processingTimeMs,
        appliedFilters: filterArray, 
        appliedSort: sort
      };
    } catch (error) {
      this.logger.error('Admin search failed', error);
      throw new InternalServerErrorException('Lỗi tìm kiếm từ MeiliSearch: ' + error.message);
    }
  }

  // Cập nhật trạng thái bài viết (Ẩn/Spam)
  async updateArticleStatus(articleId: string, status: ArticleStatus) {
    const article = await this.articleModel.findByIdAndUpdate(
      articleId, 
      { status: status },
      { new: true }
    );

    if (!article) throw new NotFoundException('Không tìm thấy bài viết');

    try {
      await this.meiliService.updateDocuments([{
        article_id: articleId,
        id: articleId,
        status: status
      }]);
    } catch (e) {
      this.logger.warn(`Failed to update status in MeiliSearch for ${articleId}`, e);
    }

    await this.systemLogService.createLog('UPDATE_ARTICLE_STATUS', 'INFO', { articleId, status }, 'admin');
    return article;
  }

  async deleteArticle(articleId: string) {
    this.logger.log(`Request to delete article: ${articleId}`);
    
    try {
        const article = await this.articleModel.findOneAndDelete({ article_id: articleId });
        
        if (!article) {
            throw new NotFoundException(`Không tìm thấy bài viết với article_id: ${articleId}`);
        }

        const results = await Promise.allSettled([
            this.meiliService.deleteDocument(articleId),
            
            // [FIX] Dùng deleteByFilter vì article_id nằm trong payload
            this.qdrantService.deleteByFilter(articleId) 
        ]);

        results.forEach((result, index) => {
            const service = index === 0 ? 'MeiliSearch' : 'Qdrant';
            if (result.status === 'rejected') {
                this.logger.warn(`Failed to delete in ${service} for ${articleId}`, result.reason);
            } else {
                this.logger.log(`Successfully deleted in ${service} for ${articleId}`);
            }
        });

        await this.systemLogService.createLog('DELETE_ARTICLE', 'WARN', { articleId }, 'admin');
        return { message: 'Deleted successfully from all databases' };

    } catch (error) {
        if (error instanceof NotFoundException) throw error;
        
        this.logger.error(`Delete article ${articleId} failed`, error);
        throw new InternalServerErrorException('Lỗi hệ thống khi xóa bài viết');
    }
  }

  async getMeiliStats() { return this.meiliService.getStats(); }

  async configureMeiliSearch() {
      return this.meiliService.updateIndexSettings();
  }

  async syncToMeiliSearch() {
    this.logger.log('Starting full sync...');
    await this.systemLogService.createLog('SYNC_START', 'INFO', {}, 'admin');

    await this.configureMeiliSearch();

    try {
        const batchSize = 1000;
        let cursor = this.articleModel.find().cursor();
        let batch = [];
        let totalSynced = 0;

        for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
            const obj = doc.toObject();
            let publishTimestamp = 0;

            if (obj.publish_date) {
                publishTimestamp = new Date(obj.publish_date).getTime();
            } else if ((obj as any).createdAt) {
                publishTimestamp = new Date((obj as any).createdAt).getTime();
            }

            batch.push({
                article_id: obj._id.toString(),
                id: obj._id.toString(),
                title: obj.title,
                summary: obj.summary,
                website: obj.website,
                publish_date: publishTimestamp,
                url: obj.url,
                ai_sentiment_score: obj.ai_sentiment_score || 0,
                site_categories: (obj as any).site_categories,
                status: (obj as any).status || 'visible'
            });

            if (batch.length >= batchSize) {
                await this.meiliService.addDocuments(batch);
                totalSynced += batch.length;
                batch = [];
            }
        }
        if (batch.length > 0) {
            await this.meiliService.addDocuments(batch);
            totalSynced += batch.length;
        }

        await this.systemLogService.createLog('SYNC_SUCCESS', 'INFO', { total: totalSynced }, 'admin');
        return { message: 'Sync completed', total: totalSynced };
    } catch (error) {
        this.logger.error('Sync failed', error);
        await this.systemLogService.createLog('SYNC_FAILED', 'ERROR', { error: error.message }, 'admin');
        throw new InternalServerErrorException('Đồng bộ thất bại');
    }
  }

  // Lấy danh sách chủ đề theo Website
  async getTopicsByWebsite(website: string) {
    const query = website ? { website } : {};
    
    const topics = await this.topicModel
      .find({ 
        ...query,
        is_active: true 
      })
      .sort({ name: 1 })
      .exec();

    return topics;
  }

  // Lấy bài báo theo chủ đề
  async getArticlesByTopic(topicName: string, website: string, page: number, limit: number) {
      const skip = (page - 1) * limit;
      const query: any = { 
          site_categories: topicName 
      };

      if (website) {
          query.website = website;
      }
      
      this.logger.log(`Fetching articles for topic "${topicName}" on site "${website || 'All'}" - Page ${page}`);

      const [articles, total] = await Promise.all([
          this.articleModel
            .find(query)
            .sort({ publish_date: -1 })
            .skip(skip)
            .limit(limit)
            .exec(),
          this.articleModel.countDocuments(query)
      ]);

      return {
          data: articles,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
      };
  }  

  async initTopicsFromHtml(website: string) {
    const url = `${this.pythonApiUrl}/topics/init-from-html`;
    this.logger.log(`Triggering topic init for website: ${website}`);

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, {}, {
            params: { website }
        })
      );

      await this.systemLogService.createLog(
        'INIT_TOPICS', 
        'INFO', 
        { website, response: response.data }, 
        'admin'
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to init topics', error.message);
      await this.systemLogService.createLog('INIT_TOPICS_FAILED', 'ERROR', { error: error.message }, 'admin');
      throw new InternalServerErrorException('Không thể khởi tạo Topic từ Python Service.');
    }
  }
}