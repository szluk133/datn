import { Controller, Post, Body, Get, Param, UsePipes, ValidationPipe, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { CreateConversationDto, ChatRequestDto, ChatResponseDto, ConversationHistoryDto, MessageHistoryDto } from './dto/chatbot.dto';
import { Public } from '@/decorator/customize';

@Controller('chatbot')
export class ChatbotController {
  private readonly logger = new Logger(ChatbotController.name);

  constructor(private readonly chatbotService: ChatbotService) {}

  @Get('health')
  @Public()
  healthCheck() {
    return {
      status: "ok",
      mode: "backend-gateway",
      version: "2.1.0"
    };
  }

  // Tạo Conversation
  @Post('conversations')
  @Public()
  @UsePipes(new ValidationPipe({ transform: true }))
  async createConversation(@Body() createDto: CreateConversationDto): Promise<{ conversation_id: string }> {
    this.logger.log(`API [POST /chatbot/conversations] - User: ${createDto.user_id}`);
    return this.chatbotService.createConversation(createDto);
  }

  // Lấy lịch sử Conversation
  @Get('conversations/:userId')
  @Public()
  async getConversationHistory(@Param('userId') userId: string): Promise<ConversationHistoryDto[]> {
    this.logger.log(`API [GET /chatbot/conversations/:userId] - User: ${userId}`);
    return this.chatbotService.getConversationHistory(userId);
  }

  // Lấy chi tiết tin nhắn
  @Get('messages/:conversationId')
  @Public()
  async getMessageHistory(@Param('conversationId') conversationId: string): Promise<MessageHistoryDto[]> {
      this.logger.log(`API [GET /chatbot/messages/:conversationId] - Conv ID: ${conversationId}`);
      return this.chatbotService.getMessagesByConversationId(conversationId);
  }

  // Gửi tin nhắn
  @Post('chat')
  @Public()
  @UsePipes(new ValidationPipe({ transform: true }))
  async chat(@Body() chatDto: ChatRequestDto): Promise<ChatResponseDto> {
    this.logger.log(`API [POST /chatbot/chat] - User: ${chatDto.user_id}, Conv: ${chatDto.conversation_id || 'new'}`);
    try {
        return await this.chatbotService.askQuestion(chatDto);
    } catch (error) {
        if (error instanceof HttpException) {
            throw error;
        }
        this.logger.error(`Unhandled error in chat endpoint`, error.stack);
        throw new HttpException('Lỗi hệ thống không xác định.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}