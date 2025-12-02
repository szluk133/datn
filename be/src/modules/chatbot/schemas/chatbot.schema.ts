import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type ConversationDocument = Conversation & Document;

@Schema({ timestamps: true, collection: 'conversations' })
export class Conversation {
    @Prop({ required: true, index: true })
    user_id: string;

    @Prop({ default: 'Cuộc trò chuyện mới' })
    title: string;

    createdAt?: Date;
}
export const ConversationSchema = SchemaFactory.createForClass(Conversation);

@Schema({ _id: false })
export class Source {
    @Prop()
    article_id: string;

    @Prop()
    title: string;

    @Prop({ required: false })
    url?: string;
}
export const SourceSchema = SchemaFactory.createForClass(Source);

@Schema({ _id: false })
export class Context {
    @Prop({ required: true })
    current_page: string;

    @Prop()
    search_id?: string;

    @Prop()
    article_id?: string;
}
export const ContextSchema = SchemaFactory.createForClass(Context);

export type MessageDocument = Message & Document;

@Schema({ timestamps: true, collection: 'messages' })
export class Message {
    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Conversation', required: true, index: true })
    conversation_id: MongooseSchema.Types.ObjectId;

    @Prop({ required: true, index: true })
    user_id: string;

    @Prop({ required: true })
    query: string;

    @Prop({ type: ContextSchema, required: true })
    context: Context;

    @Prop({ required: true })
    answer: string;

    @Prop({ type: [SourceSchema], default: [] })
    sources: Source[] | null;

    @Prop()
    intent_detected?: string;

    @Prop()
    strategy_used?: string;

    createdAt?: Date;
}
export const MessageSchema = SchemaFactory.createForClass(Message);