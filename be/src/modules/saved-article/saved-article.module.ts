import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SavedArticleController } from './saved-article.controller';
import { SavedArticleService } from './saved-article.service';
import { SavedArticle, SavedArticleSchema } from './schemas/saved-article.schema';
import { MeiliSearchModule } from '../common/meilisearch/meilisearch.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SavedArticle.name, schema: SavedArticleSchema }]),
    MeiliSearchModule

  ],
  controllers: [SavedArticleController],
  providers: [SavedArticleService],
  exports: [SavedArticleService]
})
export class SavedArticleModule {}