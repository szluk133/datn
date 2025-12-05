import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class QdrantService {
    private readonly logger = new Logger(QdrantService.name);
    private readonly qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
    private readonly apiKey = process.env.QDRANT_API_KEY; 
    private readonly collectionName = 'datn';

    constructor(private readonly httpService: HttpService) {
        if (this.apiKey) {
            const maskedKey = this.apiKey.substring(0, 4) + '***' + this.apiKey.substring(this.apiKey.length - 4);
            this.logger.log(`Qdrant Service initialized with API Key: ${maskedKey}`);
        } else {
            this.logger.warn('Qdrant Service initialized WITHOUT API Key. If your Qdrant instance requires auth, requests will fail.');
        }
    }

    private getHeaders() {
        const headers: any = {
            'Content-Type': 'application/json',
        };
        if (this.apiKey) {
            headers['api-key'] = this.apiKey;
        }
        return headers;
    }

    async deleteVector(pointId: string) {
        const url = `${this.qdrantUrl}/collections/${this.collectionName}/points/delete`;
        
        try {
            this.logger.log(`Deleting vector (ID) ${pointId} from Qdrant...`);
            
            const response = await firstValueFrom(
                this.httpService.post(url, {
                    points: [pointId]
                }, {
                    headers: this.getHeaders()
                })
            );

            this.logger.log(`Qdrant delete success: ${JSON.stringify(response.data)}`);
            return response.data;
        } catch (error) {
            const status = error.response?.status;
            if (status === 403 || status === 401) {
                this.logger.error(`Qdrant Auth Failed. Check API Key.`);
            }
            this.logger.error(`Failed to delete vector in Qdrant for id ${pointId}`, error.message);
            return null;
        }
    }

    async deleteByFilter(articleId: string) {
        const url = `${this.qdrantUrl}/collections/${this.collectionName}/points/delete`;
        
        try {
            this.logger.log(`Deleting vector by FILTER (payload.article_id == ${articleId})...`);

            const response = await firstValueFrom(
                this.httpService.post(url, {
                    filter: {
                        must: [
                            { key: "article_id", match: { value: articleId } }
                        ]
                    }
                }, {
                    headers: this.getHeaders()
                })
            );

            this.logger.log(`Qdrant filter delete success: ${JSON.stringify(response.data)}`);
            return response.data;
        } catch (error) {
            const status = error.response?.status;
            if (status === 403 || status === 401) {
                this.logger.error(`Qdrant Auth Failed during Filter Delete.`);
            }
            this.logger.error(`Failed filter delete Qdrant: ${articleId}`, error.message);
            return null;
        }
    }
}