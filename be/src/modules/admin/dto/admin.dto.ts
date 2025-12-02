import { IsString, IsOptional, IsEnum, IsNumber, Min, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export enum ArticleStatus {
    VISIBLE = 'visible',
    HIDDEN = 'hidden',
    SPAM = 'spam'
}

    export class UpdateArticleStatusDto {
    @IsEnum(ArticleStatus)
    status: ArticleStatus;
    }

    export class AdminSearchArticleDto {
    @IsOptional()
    @IsString()
    q?: string; // Keyword

    @IsOptional()
    @IsString()
    website?: string;

    @IsOptional()
    @IsString()
    status?: string;

    @IsOptional()
    @IsString()
    topic?: string;

    @IsOptional()
    @IsString()
    sort?: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    limit?: number = 20;
}