import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { Conversation, ConversationSchema } from './schemas/chatbot.schema';
import { Message, MessageSchema } from './schemas/chatbot.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
    HttpModule,
  ],
  controllers: [ChatbotController],
  providers: [ChatbotService],
  exports: [ChatbotService],
})
export class ChatbotModule {}