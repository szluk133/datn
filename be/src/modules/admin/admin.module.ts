import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SystemLog, SystemLogSchema } from '../common/SystemLog/schemas/system-log.schema';
import { SystemLogModule } from '../common/SystemLog/system-log.module';
import { HttpModule } from '@nestjs/axios';
import { Topic, TopicSchema } from './schemas/topic.schemas';

import { ArticleModule } from '../article/article.module';
import { QdrantModule } from '../common/qdrant/qdrant.module';

@Module({
  imports: [
    ArticleModule,
    SystemLogModule,
    HttpModule,
    QdrantModule,

    MongooseModule.forFeature([
      { name: SystemLog.name, schema: SystemLogSchema },
      { name: Topic.name, schema: TopicSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
