import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SystemLog, SystemLogDocument } from './schemas/system-log.schema';

@Injectable()
export class SystemLogService {
    constructor(
        @InjectModel(SystemLog.name) private logModel: Model<SystemLogDocument>,
    ) {}

    async createLog(
        action: string,
        level: 'INFO' | 'WARN' | 'ERROR',
        details: any,
        userId?: string,
    ) {
        const newLog = new this.logModel({
        action,
        level,
        details,
        user_id: userId,
        });
        return newLog.save();
    }

    async getLogs(limit: number = 50) {
        return this.logModel.find().sort({ createdAt: -1 }).limit(limit).exec();
    }
}