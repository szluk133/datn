import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SystemLog, SystemLogSchema } from './schemas/system-log.schema';
import { SystemLogService } from './system-loc.service';

@Global()
@Module({
    imports: [
        MongooseModule.forFeature([{ name: SystemLog.name, schema: SystemLogSchema }]),
    ],
    providers: [SystemLogService],
  exports: [SystemLogService],
})
export class SystemLogModule {}