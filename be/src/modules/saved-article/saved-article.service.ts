import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SavedArticle, SavedArticleDocument } from './schemas/saved-article.schema';
import { CreateSavedArticleDto } from './dto/create-saved-article.dto';
import { MeiliSearchService } from '@/modules/common/meilisearch/meilisearch.service';
@Injectable()
export class SavedArticleService {
  constructor(
    @InjectModel(SavedArticle.name) private savedArticleModel: Model<SavedArticleDocument>,
    private readonly meiliService: MeiliSearchService,
  ) {}

  // Lưu bài viết
  async saveArticle(userId: string, createDto: CreateSavedArticleDto) {
    try {
      const created = new this.savedArticleModel({
        user_id: userId,
        ...createDto
      });
      return await created.save();
    } catch (error) {
      if (error.code === 11000) {
        throw new ConflictException('Bạn đã lưu bài viết này rồi');
      }
      throw error;
    }
  }

  // Xóa bài viết đã lưu
  async removeArticle(userId: string, articleId: string) {
    const result = await this.savedArticleModel.findOneAndDelete({
      user_id: userId,
      article_id: articleId,
    });

    if (!result) {
      throw new NotFoundException('Bài viết không có trong danh sách đã lưu');
    }

    return { message: 'Đã xóa khỏi danh sách lưu trữ' };
  }

  // Kiểm tra trạng thái đã lưu chưa (Check status)
  async checkSavedStatus(userId: string, articleId: string) {
      const exists = await this.savedArticleModel.exists({ user_id: userId, article_id: articleId });
      return { isSaved: !!exists };
  }

  
  async getUserSavedArticles(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    
    const [savedDocs, total] = await Promise.all([
      this.savedArticleModel
        .find({ user_id: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.savedArticleModel.countDocuments({ user_id: userId })
    ]);

    const articleIds = savedDocs.map(doc => doc.article_id);
    let enrichedData = [];

    if (articleIds.length > 0) {
        const meiliDocs = await this.meiliService.getDocumentsByArticleIds(articleIds);
        
        enrichedData = savedDocs.map(saved => {
            const savedObj = saved.toJSON();
            const meiliInfo = meiliDocs.find((m: any) => m.article_id === saved.article_id);
            
            return {
                ...savedObj,
                
                title: meiliInfo?.title || savedObj.article_title,
                url: meiliInfo?.url || savedObj.article_url,
                
                website: meiliInfo?.website || null,
                publish_date: meiliInfo?.publish_date || null,
                ai_sentiment_score: meiliInfo?.ai_sentiment_score ?? null,
                site_categories: meiliInfo?.site_categories || [],
                status: meiliInfo?.status || 'unknown'
            };
        });
    }

    return {
      data: enrichedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }
}