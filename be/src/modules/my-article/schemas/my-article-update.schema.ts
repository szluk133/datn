import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MyArticleUpdateDocument = MyArticleUpdate & Document;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, collection: 'my_article_updates' })
export class MyArticleUpdate {
    // _id được MongoDB tự tạo

    @Prop({ required: true, unique: true, index: true })
    update_id: string;

    @Prop({ required: true, index: true })
    user_id: string;

    // timestamps: true sẽ tự tạo field created_at (thời gian update) và updated_at
}

export const MyArticleUpdateSchema = SchemaFactory.createForClass(MyArticleUpdate);