import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MeiliSearch, Index } from 'meilisearch';

@Injectable()
export class MeiliSearchService implements OnModuleInit {
    private client: MeiliSearch;
    private index: Index;
    private readonly logger = new Logger(MeiliSearchService.name);

    constructor() {
        this.client = new MeiliSearch({
        host: process.env.MEILISEARCH_URL,
        apiKey: process.env.MEILISEARCH_KEY,
        });
    }

    async onModuleInit() {
        this.index = this.client.index('articles');
        
        try {
        await this.index.updateFilterableAttributes([
            'article_id',
            'website',
            'site_categories',
            'publish_date',
            'ai_sentiment_score',
            'status', 
            'search_id'
        ]);

        await this.index.updateSortableAttributes([
            'publish_date', 
            'ai_sentiment_score'
        ]);

        await this.index.updateSearchableAttributes([
            'title',
            'summary',
            'content',
            'ai_summary'
        ]);

        this.logger.log('MeiliSearch attributes updated successfully (Phase 2 Config)');
        } catch (error) {
        this.logger.error('Failed to init MeiliSearch attributes', error);
        }
    }

    public getIndex() {
        return this.index;
    }

    async search(query: string, options: any = {}) {
        return this.index.search(query, options);
    }

    // Lấy thông số kỹ thuật (Stats)
    async getStats() {
        return this.index.getStats();
    }

    // Xóa tài liệu (Khi Admin xóa cứng)
    async deleteDocument(id: string) {
        return this.index.deleteDocument(id);
    }

    // Cập nhật một phần tài liệu (Ví dụ: Update status = hidden)
    async updateDocuments(documents: any[]) {
        return this.index.updateDocuments(documents);
    }

    // Thêm mới/Ghi đè tài liệu
    async addDocuments(documents: any[]) {
        return this.index.addDocuments(documents);
    }

    // Xóa toàn bộ documents
    async deleteAllDocuments() {
        return this.index.deleteAllDocuments();
    }

    async getDocumentsByArticleIds(articleIds: string[]) {
        if (!articleIds.length) return [];
        
        try {
        const filter = `article_id IN [${articleIds.map(id => `"${id}"`).join(', ')}]`;
        
        const result = await this.index.search('', {
            filter: filter,
            limit: articleIds.length,
            attributesToRetrieve: [
                'article_id', 
                'title', 
                'url', 
                'website', 
                'publish_date', 
                'ai_sentiment_score', 
                'site_categories',
                'status'
            ]
        });
        
        return result.hits;
        } catch (error) {
        this.logger.error('Failed to fetch documents by IDs from MeiliSearch', error);
        return [];
        }
    }
}