import { PaginatedArticleResponse } from './pagination.dto';
import { SearchHistoryResponseDto } from './search-history';

export class SearchResponseDto {
    newHistoryItem: SearchHistoryResponseDto;
    results: PaginatedArticleResponse;
}
