import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ArticleDocument = Article & Document;

@Schema({ timestamps: true, collection: 'articles' })
export class Article {
    @Prop({ required: true })
    title: string;

    @Prop({ required: true })
    summary: string;

    @Prop({ required: true })
    content: string;
    
    @Prop({ required: true })
    website: string;

    @Prop({ required: true })
    publish_date: string;

    @Prop({ required: true })
    url: string;

    @Prop({ required: true, index: true })
    search_id: string;

    @Prop({ required: true, index: true })
    user_id: string;

    @Prop()
    ai_sentiment_score: number;

    @Prop()
    site_categories: string[];

    @Prop()
    ai_summary: string[]; 

    @Prop({ default: 'visible' }) // visible, hidden, spam
    status: string;
}

export const ArticleSchema = SchemaFactory.createForClass(Article);

ArticleSchema.set('toJSON', {
    virtuals: true,
    transform: (doc, ret) => {
        return {
            id: doc._id.toString(),
            title: ret.title,
            summary: ret.summary,
            website: ret.website,
            publish_date: ret.publish_date,
            url: ret.url,
            ai_sentiment_score: (ret.ai_sentiment_score !== undefined && ret.ai_sentiment_score !== null) ? Number(ret.ai_sentiment_score) : null,
            ai_summary: ret.ai_summary || [],
            site_categories: ret.site_categories || [],
        };
    },
});