export class SearchHistoryResponseDto {
    _id: string;
    search_id: string;
    keyword_search: string;
    keyword_content: string;
    time_range: string;
    websites_crawled: string[];
    status: string;
}