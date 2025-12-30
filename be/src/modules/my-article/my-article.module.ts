import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { MyArticleController } from './my-article.controller';
import { MyArticleService } from './my-article.service';
import { MyArticle, MyArticleSchema } from '@/modules/my-article/schemas/my-article.schema';
import { MyArticleUpdate, MyArticleUpdateSchema } from '@/modules/my-article/schemas/my-article-update.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MyArticle.name, schema: MyArticleSchema },
      { name: MyArticleUpdate.name, schema: MyArticleUpdateSchema }, // Đăng ký Schema mới
    ]),
    HttpModule,
  ],
  controllers: [MyArticleController],
  providers: [MyArticleService],
  exports: [MyArticleService],
})
export class MyArticleModule {}