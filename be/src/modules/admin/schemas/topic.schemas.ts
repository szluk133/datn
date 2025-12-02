import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TopicDocument = Topic & Document;

@Schema({ timestamps: false, collection: 'topics' })
export class Topic {
    @Prop()
    url: string;

    @Prop()
    is_active: boolean;

    @Prop()
    last_scanned_at: Date;

    @Prop({ required: true })
    name: string;

    @Prop({ required: true, index: true })
    website: string;

    @Prop()
    last_crawled_at: Date;
}

export const TopicSchema = SchemaFactory.createForClass(Topic);

TopicSchema.set('toJSON', {
    virtuals: true,
    transform: (doc, ret) => {
        return {
        id: doc._id.toString(),
        name: ret.name,
        website: ret.website,
        url: ret.url,
        is_active: ret.is_active,
        last_crawled_at: ret.last_crawled_at
        };
    },
});