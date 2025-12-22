import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SavedArticle, SavedArticleDocument } from './schemas/saved-article.schema';
import { CreateSavedArticleDto } from './dto/create-saved-article.dto';

@Injectable()
export class SavedArticleService {
  constructor(
    @InjectModel(SavedArticle.name) private savedArticleModel: Model<SavedArticleDocument>,
  ) {}

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
        .lean()
        .exec(),
      this.savedArticleModel.countDocuments({ user_id: userId })
    ]);

    const formattedData = savedDocs.map(doc => ({
        _id: doc._id,
        user_id: doc.user_id,
        article_id: doc.article_id,
        
        title: doc.title, 
        url: doc.url,
        
        website: doc.website,
        summary: doc.summary,
        site_categories: doc.site_categories,
        ai_sentiment_score: doc.ai_sentiment_score,
        publish_date: doc.publish_date,
        saved_at: (doc as any).createdAt
    }));

    return {
      data: formattedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }
}