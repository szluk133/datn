import { IsNotEmpty, IsString, IsOptional, IsArray, IsNumber, IsDateString } from 'class-validator';

export class CreateSavedArticleDto {
    @IsString()
    @IsNotEmpty()
    user_id: string;
    
    @IsString()
    @IsNotEmpty()
    article_id: string;

    @IsString()
    @IsOptional()
    title?: string;

    @IsString()
    @IsOptional()
    url?: string;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    site_categories?: string[];

    @IsString()
    @IsOptional()
    website?: string;

    @IsString()
    @IsOptional()
    summary?: string;

    @IsNumber()
    @IsOptional()
    ai_sentiment_score?: number;

    @IsDateString()
    @IsOptional()
    publish_date?: string;
}