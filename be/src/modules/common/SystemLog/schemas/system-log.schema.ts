import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SystemLogDocument = SystemLog & Document;

@Schema({ timestamps: true, collection: 'system_logs' })
export class SystemLog {
    @Prop({ required: true })
    action: string; // e.g., 'CRAWL', 'LOGIN', 'EXPORT'

    @Prop({ required: true })
    level: string; // 'INFO', 'ERROR', 'WARN'

    @Prop()
    user_id: string;

    @Prop({ type: Object })
    details: any;

    @Prop({ default: Date.now })
    timestamp: Date;
}

export const SystemLogSchema = SchemaFactory.createForClass(SystemLog);