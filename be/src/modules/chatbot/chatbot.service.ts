import { Injectable, InternalServerErrorException, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { Conversation, ConversationDocument } from './schemas/chatbot.schema';
import { Message, MessageDocument } from './schemas/chatbot.schema';
import { 
    ChatRequestDto, 
    ChatResponseDto, 
    CreateConversationDto, 
    ConversationHistoryDto, 
    MessageHistoryDto 
} from './dto/chatbot.dto';

interface ExternalSource {
  article_id: string;
  title: string;
  url?: string;
}

interface ExternalChatResponse {
  answer: string;
  conversation_id: string;
  sources: ExternalSource[] | null;
  intent_detected?: string;
  strategy_used?: string;
}

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private readonly externalChatApiUrl = process.env.CHATBOT_API_URL || 'http://localhost:5000/api/chat'; 

  constructor(
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    private readonly httpService: HttpService,
  ) {}

  // Tạo cuộc trò chuyện mới
  async createConversation(createDto: CreateConversationDto): Promise<{ conversation_id: string }> {
    const newConversation = new this.conversationModel({
      user_id: createDto.user_id,
      title: `Cuộc trò chuyện mới`,
    });
    await newConversation.save();
    this.logger.log(`New conversation created for user ${createDto.user_id} with ID ${newConversation._id}`);
    return { conversation_id: newConversation._id.toString() };
  }

  // Lấy lịch sử cuộc trò chuyện
  async getConversationHistory(userId: string): Promise<ConversationHistoryDto[]> {
    const conversations = await this.conversationModel
      .find({ user_id: userId })
      .sort({ createdAt: -1 })
      .exec();

    return conversations.map(conv => ({
      conversation_id: conv._id.toString(),
      created_at: conv.createdAt,
      title: conv.title,
    }));
  }
  
  // Lấy chi tiết tin nhắn
  async getMessagesByConversationId(conversationId: string): Promise<MessageHistoryDto[]> {
    const messages = await this.messageModel
      .find({ conversation_id: conversationId })
      .sort({ createdAt: 'asc' })
      .exec();

    return messages.map(msg => ({
        _id: msg._id.toString(),
        query: msg.query,
        answer: msg.answer,
        created_at: msg.createdAt,
        intent_detected: msg.intent_detected,
        strategy_used: msg.strategy_used,
        sources: msg.sources ? msg.sources.map(s => ({
            article_id: s.article_id,
            title: s.title,
            url: s.url,
        })) : [],
    }));
  }

  async askQuestion(chatDto: ChatRequestDto): Promise<ChatResponseDto> {
    let conversationId = chatDto.conversation_id;

    if (!conversationId) {
      const newConv = await this.createConversation({ user_id: chatDto.user_id });
      conversationId = newConv.conversation_id;
    }

    const externalApiPayload = {
      user_id: chatDto.user_id,
      query: chatDto.query,
      conversation_id: conversationId,
      context: chatDto.context, 
    };

    let externalResponse: ExternalChatResponse;
    try {
      this.logger.log(`Calling RAG API at ${this.externalChatApiUrl} with payload: ${JSON.stringify(externalApiPayload)}`);
      
      const response = await firstValueFrom(
        this.httpService.post<ExternalChatResponse>(this.externalChatApiUrl, externalApiPayload),
      );
      externalResponse = response.data;

      if (!externalResponse || typeof externalResponse.answer === 'undefined') {
        throw new Error('Invalid response structure from RAG API.');
      }
    } catch (error) {
      this.logger.error(`Error calling RAG API: ${error.message}`, error.stack);
      if (error.response) {
        this.logger.error(`RAG API Status: ${error.response.status}`);
        this.logger.error(`RAG API Data: ${JSON.stringify(error.response.data)}`);
      }
      throw new InternalServerErrorException('Hệ thống AI đang bận hoặc gặp sự cố.');
    }

    const newMessage = new this.messageModel({
      conversation_id: conversationId,
      user_id: chatDto.user_id,
      query: chatDto.query,
      context: chatDto.context,
      answer: externalResponse.answer,
      sources: externalResponse.sources || [],
      intent_detected: externalResponse.intent_detected,
      strategy_used: externalResponse.strategy_used,
    });
    await newMessage.save();
    
    if (!chatDto.conversation_id) {
        await this.conversationModel.findByIdAndUpdate(conversationId, { title: chatDto.query });
    }

    return {
      answer: externalResponse.answer,
      conversation_id: conversationId,
      sources: externalResponse.sources ? externalResponse.sources.map(s => ({
          article_id: s.article_id,
          title: s.title,
          url: s.url
      })) : [],
      intent_detected: externalResponse.intent_detected,
      strategy_used: externalResponse.strategy_used
    };
  }
}