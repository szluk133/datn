import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateSavedArticleDto {
    @IsString()
    @IsNotEmpty()
    user_id: string;
    
    @IsString()
    @IsNotEmpty()
    article_id: string;

    @IsString()
    @IsOptional()
    article_title?: string;

    @IsString()
    @IsOptional()
    article_url?: string;
}