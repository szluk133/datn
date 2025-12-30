import { IsNotEmpty, IsOptional, IsString, IsArray, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMyArticleDto {
    @IsNotEmpty({ message: 'User ID là bắt buộc' })
    @IsString()
    user_id: string;

    @IsNotEmpty({ message: 'Nội dung là bắt buộc' })
    @IsString()
    content: string;

    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsString()
    website?: string;

    @IsOptional()
    @IsString()
    publish_date?: string;

    @IsOptional()
    @IsString()
    update_id?: string;
}

export class ImportMyArticlesDto {
    @IsNotEmpty({ message: 'User ID là bắt buộc' })
    @IsString()
    user_id: string;

    @IsOptional()
    @IsString()
    update_id?: string;
}

export class EnrichMyArticlesDto {
    @IsNotEmpty({ message: 'User ID là bắt buộc' })
    @IsString()
    user_id: string;

    @IsNotEmpty({ message: 'Update ID (Batch ID) là bắt buộc' })
    @IsString()
    update_id: string;
}

export class GetMyArticlesDto {
    @IsNotEmpty({ message: 'User ID là bắt buộc' })
    @IsString()
    user_id: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    limit?: number = 10;

    @IsOptional()
    @IsString()
    update_id?: string;
}

export class ExportMyArticlesDto {
    @IsNotEmpty({ message: 'User ID là bắt buộc' })
    @IsString()
    user_id: string;

    @IsOptional()
    @IsString()
    type?: 'single' | 'batch' | 'list' = 'batch'; 

    @IsOptional()
    @IsString()
    id?: string; 

    @IsOptional()
    @IsString()
    ids?: string; 
}

// [MỚI] DTO cho API lấy lịch sử update
export class GetUpdateHistoryDto {
    @IsNotEmpty({ message: 'User ID là bắt buộc' })
    @IsString()
    user_id: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    limit?: number = 10;
}