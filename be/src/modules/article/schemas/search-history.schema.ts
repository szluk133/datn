import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SearchHistoryDocument = SearchHistory & Document;

@Schema({ timestamps: true, collection: 'search_history' }) 
export class SearchHistory {
    @Prop({ required: true, unique: true, index: true })
    search_id: string;

    @Prop({ required: true })
    keyword_search: string;

    @Prop({ required: true })
    keyword_content: string;

    @Prop({ required: true })
    time_range: string;

    @Prop({ required: true, index: true })
    user_id: string;

    @Prop({ type: [String], required: true })
    websites_crawled: string[];

    @Prop({ default: 'processing', index: true }) 
    status: string;
}

export const SearchHistorySchema = SchemaFactory.createForClass(SearchHistory);

SearchHistorySchema.set('toJSON', {
    virtuals: true,
    transform: (doc, ret) => {
        return {
            _id: doc._id.toString(),
            search_id: ret.search_id,
            keyword_search: ret.keyword_search,
            keyword_content: ret.keyword_content,
            time_range: ret.time_range,
            websites_crawled: ret.websites_crawled,
            status: ret.status || 'completed',
        };
    },
});