import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WebsiteDocument = Website & Document;

@Schema({ timestamps: true, collection: 'websites' })
export class Website {
    @Prop({ required: true, unique: true })
    name: string;

    @Prop({ required: true })
    displayName: string;
}

export const WebsiteSchema = SchemaFactory.createForClass(Website);