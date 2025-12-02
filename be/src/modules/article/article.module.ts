import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { Article, ArticleSchema } from './schemas/article.schema';
import { ArticleController } from './article.controller';
import { ArticleService } from './article.service';
import { SearchHistory, SearchHistorySchema } from './schemas/search-history.schema';
import { Website, WebsiteSchema } from './schemas/website.schema';
import { MeiliSearchModule } from '../common/meilisearch/meilisearch.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Article.name, schema: ArticleSchema },
      { name: SearchHistory.name, schema: SearchHistorySchema },
      { name: Website.name, schema: WebsiteSchema }
    ]),
    HttpModule,
    MeiliSearchModule,
  ],
  controllers: [ArticleController],
  providers: [ArticleService],
  exports: [
    ArticleService,
    MongooseModule, 
  ],
})
export class ArticleModule {}
