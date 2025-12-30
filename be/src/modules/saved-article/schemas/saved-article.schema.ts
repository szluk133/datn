import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SavedArticleDocument = SavedArticle & Document;

@Schema({ timestamps: true, collection: 'saved_articles' })
export class SavedArticle {
    @Prop({ required: true, index: true })
    user_id: string;

    @Prop({ required: true }) 
    article_id: string;

    @Prop()
    title: string;

    @Prop()
    url: string;

    @Prop({ type: [String], default: [] })
    site_categories: string[];

    @Prop()
    website: string;

    @Prop()
    summary: string;

    @Prop()
    ai_sentiment_label: string;

    @Prop()
    ai_sentiment_score: number;

    @Prop({ type: Date })
    publish_date: Date;
}

export const SavedArticleSchema = SchemaFactory.createForClass(SavedArticle);
SavedArticleSchema.index({ user_id: 1, article_id: 1 }, { unique: true });