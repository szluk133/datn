import { IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ArticleResponseDto } from './crawl-request';

export class PaginationParamsDto {
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    limit?: number;
}
export interface SentimentStats {
    positive: number;
    negative: number;
    neutral: number;
}
export interface PaginatedArticleResponse {
    data: ArticleResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    sentiment_stats?: SentimentStats;
}
