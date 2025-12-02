import { IsString, IsInt, IsNotEmpty, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class CrawlRequestDto {
    @IsArray()
    @IsString({ each: true })
    websites: string[];

    @IsString()
    @IsNotEmpty()
    keyword_search: string;

    @IsString()
    @IsNotEmpty()
    keyword_content: string;

    @Type(() => Number)
    @IsInt()
    max_articles: number;

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

export class ArticleResponseDto {
    id: string;
    title: string;
    summary: string;
    website: string;
    publish_date: string;
    url: string;
    
    ai_sentiment_score: number | null; 
    ai_summary?: string[];
    site_categories?: string[];
}