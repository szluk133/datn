import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MyArticleDocument = MyArticle & Document;

@Schema({ timestamps: true, collection: 'my_articles' })
export class MyArticle {
    @Prop({ required: true, index: true })
    article_id: string;

    @Prop({ required: true })
    content: string;

    @Prop({ default: '' })
    title: string;

    @Prop({ default: '' })
    website: string;

    @Prop({ default: () => new Date().toISOString() })
    publish_date: string;

    @Prop({ required: true, default: 'my_page', index: true })
    search_id: string;

    @Prop({ required: true, index: true })
    user_id: string;

    @Prop({ index: true })
    update_id: string;

    @Prop({ type: [String], default: [] })
    ai_summary: string[];

    @Prop({ default: '' })
    ai_sentiment_label: string;

    @Prop({ default: 0 })
    ai_sentiment_score: number;
}

export const MyArticleSchema = SchemaFactory.createForClass(MyArticle);