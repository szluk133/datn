import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { QdrantService } from './qdrant.service';

@Global()
@Module({
    imports: [HttpModule],
    providers: [QdrantService],
    exports: [QdrantService],
})
export class QdrantModule {}