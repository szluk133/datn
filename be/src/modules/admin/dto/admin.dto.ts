import { IsString, IsOptional, IsEnum, IsNumber, Min, Max, IsDateString } from 'class-validator';
import { Type, Transform } from 'class-transformer';

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
    q?: string;

    @IsOptional()
    @IsString()
    website?: string;

    @IsOptional()
    @IsEnum(ArticleStatus)
    status?: ArticleStatus;

    @IsOptional()
    @IsString()
    topic?: string;

    @IsOptional()
    @IsDateString()
    startDate?: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;

    @IsOptional()
    @IsString()
    sentimentLabel?: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0) // Score giờ là độ tin cậy (0-1)
    @Max(1)
    minSentiment?: number; // Lọc theo độ tin cậy tối thiểu

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @Max(1)
    maxSentiment?: number;

    @IsOptional()
    @Transform(({ value }) => {
        if (typeof value === 'string') return [value];
        if (Array.isArray(value)) return value;
        return value;
    })
    @IsString({ each: true })
    sort?: string[];

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