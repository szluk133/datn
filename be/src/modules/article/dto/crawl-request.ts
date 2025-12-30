import { IsString, IsInt, IsNotEmpty, IsArray, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CrawlRequestDto {
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    websites?: string[];

    @IsString()
    @IsNotEmpty()
    keyword_search: string;

    @IsString()
    @IsOptional()
    keyword_content?: string;

    @Type(() => Number)
    @IsInt()
    @IsOptional()
    max_articles?: number;

    @IsString()
    @IsNotEmpty()
    start_date: string;

    @IsString()
    @IsNotEmpty()
    end_date: string;

    @IsString()
    @IsNotEmpty()
    user_id: string;
}

export class CrawlTriggerResponseDto {
    status: string;
    search_id: string;
    stream_url: string;
    meta: any;
}

export class ArticleResponseDto {
    id: string;
    title: string;
    summary: string;
    website: string;
    publish_date: string;
    url: string;
    
    ai_sentiment_label: string | null;
    ai_sentiment_score: number | null; 
    ai_summary?: string[];
    site_categories?: string[];
}