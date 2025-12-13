import { IsNotEmpty, IsString, IsOptional, IsMongoId, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';


export enum PageContext {
    HOME_PAGE = 'home_page',
    LIST_PAGE = 'list_page',
    DETAIL_PAGE = 'detail_page',
}

export enum SortBy {
    PUBLISH_DATE = 'publish_date',
    SENTIMENT = 'sentiment'
}

export enum SortOrder {
    ASC = 'asc',
    DESC = 'desc'
}

export class ContextDto {
    @IsEnum(PageContext)
    @IsNotEmpty()
    current_page: string;

    @IsOptional()
    @IsString()
    search_id?: string;

    @IsOptional()
    @IsString()
    article_id?: string;

    @IsOptional()
    @IsString()
    sort_by?: string;

    @IsOptional()
    @IsEnum(SortOrder)
    sort_order?: string;
}

export class SourceDto {
    @IsString()
    article_id: string;

    @IsString()
    title: string;

    @IsOptional()
    @IsString()
    url?: string;
}

export class CreateConversationDto {
    @IsString()
    @IsNotEmpty()
    user_id: string;
}

export class ChatRequestDto {
    @IsOptional()
    @IsMongoId()
    conversation_id?: string;

    @IsString()
    @IsNotEmpty()
    user_id: string;

    @IsString()
    @IsNotEmpty()
    query: string;

    @IsNotEmpty()
    @ValidateNested()
    @Type(() => ContextDto)
    context: ContextDto;
}

export class ChatResponseDto {
    @IsString()
    answer: string;

    @IsString()
    conversation_id: string;

    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => SourceDto)
    sources: SourceDto[] | null;

    @IsOptional()
    @IsString()
    intent_detected?: string;

    @IsOptional()
    @IsString()
    strategy_used?: string;
}

export class ConversationHistoryDto {
    conversation_id: string;
    created_at: Date;
    title: string;
}

export class MessageHistoryDto {
    _id: string;
    query: string;
    answer: string;
    created_at: Date;
    
    @IsOptional()
    intent_detected?: string;

    @IsOptional()
    strategy_used?: string;

    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => SourceDto)
    sources: SourceDto[] | null;
}