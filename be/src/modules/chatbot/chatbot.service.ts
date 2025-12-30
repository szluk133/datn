import { Injectable, InternalServerErrorException, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { Conversation, ConversationDocument } from './schemas/chatbot.schema';
import { Message, MessageDocument } from './schemas/chatbot.schema';
import { Article, ArticleDocument } from '../article/schemas/article.schema';
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
  dependency_label?: string;
}

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private readonly externalChatApiUrl = process.env.CHATBOT_API_URL || 'http://localhost:5000/api/chat'; 

  constructor(
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(Article.name) private articleModel: Model<ArticleDocument>,
    private readonly httpService: HttpService,
  ) {}

  async createConversation(createDto: CreateConversationDto): Promise<{ conversation_id: string }> {
    const newConversation = new this.conversationModel({
      user_id: createDto.user_id,
      title: `Cuộc trò chuyện mới`,
    });
    await newConversation.save();
    this.logger.log(`New conversation created for user ${createDto.user_id} with ID ${newConversation._id}`);
    return { conversation_id: newConversation._id.toString() };
  }

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
        sources: msg.sources ? msg.sources.map(s => ({
            _id: s._id,
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

    let mappedSources = [];
    if (externalResponse.sources && externalResponse.sources.length > 0) {
        const articleIds = externalResponse.sources.map(s => s.article_id);
        const articles = await this.articleModel.find({ article_id: { $in: articleIds } }).select('article_id _id').exec();
        
        const articleMap = new Map(articles.map(a => [a.article_id, a._id.toString()]));

        mappedSources = externalResponse.sources.map(s => ({
            _id: articleMap.get(s.article_id) || s.article_id,
            title: s.title,
            url: s.url
        }));
    }

    // Lưu vào DB (bao gồm cả dependency_label)
    const newMessage = new this.messageModel({
      conversation_id: conversationId,
      user_id: chatDto.user_id,
      query: chatDto.query,
      context: chatDto.context,
      answer: externalResponse.answer,
      sources: mappedSources,
      intent_detected: externalResponse.intent_detected,
      strategy_used: externalResponse.strategy_used,
      dependency_label: externalResponse.dependency_label, // Lưu thêm trường này
    });
    await newMessage.save();
    
    if (!chatDto.conversation_id) {
        await this.conversationModel.findByIdAndUpdate(conversationId, { title: chatDto.query });
    }

    // Trả về FE (KHÔNG bao gồm các trường log hệ thống)
    return {
      answer: externalResponse.answer,
      conversation_id: conversationId,
      sources: mappedSources,
    };
  }
}