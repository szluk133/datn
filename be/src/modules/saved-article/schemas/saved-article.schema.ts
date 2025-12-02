import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type SavedArticleDocument = SavedArticle & Document;

@Schema({ timestamps: true, collection: 'saved_articles' })
export class SavedArticle {
    @Prop({ required: true, index: true })
    user_id: string;

    @Prop({ required: true }) 
    article_id: string;

    @Prop()
    article_title: string;

    @Prop()
    article_url: string;
}

export const SavedArticleSchema = SchemaFactory.createForClass(SavedArticle);
SavedArticleSchema.index({ user_id: 1, article_id: 1 }, { unique: true });