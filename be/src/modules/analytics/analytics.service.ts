import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Article, ArticleDocument } from '../article/schemas/article.schema';
import { SearchHistory, SearchHistoryDocument } from '../article/schemas/search-history.schema';

@Injectable()
export class AnalyticsService {
    constructor(
        @InjectModel(Article.name) private articleModel: Model<ArticleDocument>,
        @InjectModel(SearchHistory.name) private searchHistoryModel: Model<SearchHistoryDocument>,
    ) {}

  // 1. Phát hiện từ khóa Hot
    async getHotKeywords(days: number) {
        const since = new Date();
        since.setDate(since.getDate() - days);

        const searchTrends = await this.searchHistoryModel.aggregate([
            { 
                $match: { 
                    keyword_search: { $exists: true, $ne: "" }
                } 
            },
            { 
                $group: { 
                    _id: "$keyword_search", 
                    count: { $sum: 1 },
                    lastSearched: { $max: "$createdAt" } 
                } 
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        return {
            period: `Last ${days} days`,
            hotSearchKeywords: searchTrends.map(item => ({
                keyword: item._id,
                count: item.count,
                lastSearched: item.lastSearched || new Date()
            }))
        };
    }

    // 2. Biểu đồ xu hướng cảm xúc
    async getSentimentTrend(days?: number, fromDateStr?: string, toDateStr?: string) {
        let startDate: Date;
        let endDate: Date = new Date();

        if (fromDateStr) {
            startDate = new Date(fromDateStr);
            if (toDateStr) {
                endDate = new Date(toDateStr);
                endDate.setHours(23, 59, 59, 999);
            }
        } else {
            const numDays = days || 30;
            startDate = new Date();
            startDate.setDate(startDate.getDate() - numDays);
            startDate.setHours(0, 0, 0, 0);
        }

        if (isNaN(startDate.getTime())) {
            startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);
        }

        const trend = await this.articleModel.aggregate([
            { 
                $match: { 
                    ai_sentiment_score: { $exists: true, $ne: null }
                }
            },
            {
                $addFields: {
                    convertedDate: { $toDate: "$publish_date" }
                }
            },
            {
                $match: {
                    convertedDate: { 
                        $gte: startDate, 
                        $lte: endDate 
                    }
                }
            },
            {
                $group: {
                    _id: { 
                        year: { $year: "$convertedDate" }, 
                        month: { $month: "$convertedDate" }, 
                        day: { $dayOfMonth: "$convertedDate" } 
                    },
                    avgSentiment: { $avg: "$ai_sentiment_score" },
                    totalArticles: { $sum: 1 },
                    positiveCount: { $sum: { $cond: [{ $gt: ["$ai_sentiment_score", 0.2] }, 1, 0] } },
                    negativeCount: { $sum: { $cond: [{ $lt: ["$ai_sentiment_score", -0.2] }, 1, 0] } },
                    neutralCount: { 
                        $sum: { 
                            $cond: [
                                { $and: [
                                    { $gte: ["$ai_sentiment_score", -0.2] }, 
                                    { $lte: ["$ai_sentiment_score", 0.2] }
                                ]}, 
                                1, 
                                0
                            ] 
                        } 
                    }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
        ]);

        return trend.map(t => ({
            date: `${t._id.day}/${t._id.month}/${t._id.year}`,
            avgSentiment: parseFloat(t.avgSentiment.toFixed(2)),
            totalArticles: t.totalArticles,
            breakdown: {
                positive: t.positiveCount,
                negative: t.negativeCount,
                neutral: t.neutralCount
            }
        }));
        }

    // 3. Báo cáo tổng hợp
    async getSummaryReport() {
        const days = 30; 
        const [hotKeywords, sentimentTrend] = await Promise.all([
            this.getHotKeywords(days),
            this.getSentimentTrend(days)
        ]);

        return {
            reportType: 'Summary Report',
            generatedAt: new Date(),
            data: {
                trends: hotKeywords,
                sentimentGraph: sentimentTrend
            }
        };
    }

    // So sánh cảm xúc giữa các nguồn báo
    async getSourceSentimentComparison() {
        const stats = await this.articleModel.aggregate([
        { 
            $match: { 
            ai_sentiment_score: { $exists: true, $ne: null } 
            } 
        },
        {
            $group: {
            _id: "$website",
            avgSentiment: { $avg: "$ai_sentiment_score" },
            totalArticles: { $sum: 1 },
            positiveCount: { $sum: { $cond: [{ $gt: ["$ai_sentiment_score", 0.2] }, 1, 0] } },
            negativeCount: { $sum: { $cond: [{ $lt: ["$ai_sentiment_score", -0.2] }, 1, 0] } },
            neutralCount: { 
                $sum: { 
                    $cond: [
                        { $and: [
                            { $gte: ["$ai_sentiment_score", -0.2] }, 
                            { $lte: ["$ai_sentiment_score", 0.2] }
                        ]}, 
                        1, 
                        0
                    ] 
                } 
            }
            }
        },
        { $sort: { avgSentiment: -1 } } // Sắp xếp từ tích cực nhất đến tiêu cực nhất
        ]);

        return stats.map(item => ({
        source: item._id,
        avgSentiment: parseFloat(item.avgSentiment.toFixed(2)),
        total: item.totalArticles,
        breakdown: {
            positive: item.positiveCount,
            negative: item.negativeCount,
            neutral: item.neutralCount
        }
        }));
    }

    // Phân phối danh mục (Pie Chart)
    async getCategoryDistribution() {
        const distribution = await this.articleModel.aggregate([
        { $unwind: "$site_categories" },
        {
            $group: {
            _id: "$site_categories",
            count: { $sum: 1 }
            }
        },
        { $sort: { count: -1 } },
        { $limit: 15 }
        ]);

        const total = distribution.reduce((acc, curr) => acc + curr.count, 0);

        return distribution.map(item => ({
        category: item._id,
        count: item.count,
        percentage: parseFloat(((item.count / total) * 100).toFixed(2))
        }));
    }
}