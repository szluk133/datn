import { Module, Global } from '@nestjs/common';
import { MeiliSearchService } from './meilisearch.service';

@Global()
@Module({
  providers: [MeiliSearchService],
  exports: [MeiliSearchService],
})
export class MeiliSearchModule {}