import { 
    Controller, Post, Get, Body, Query, Res, UsePipes, ValidationPipe, 
    Logger, UploadedFile, UseInterceptors, BadRequestException 
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { MyArticleService } from './my-article.service';
import { 
    CreateMyArticleDto, 
    ImportMyArticlesDto, 
    EnrichMyArticlesDto,
    GetMyArticlesDto,
    ExportMyArticlesDto,
    GetUpdateHistoryDto // Import DTO mới
} from '@/modules/my-article/dto/create-my-article.dto';

@Controller('my-articles')
export class MyArticleController {
  private readonly logger = new Logger(MyArticleController.name);

  constructor(private readonly myArticleService: MyArticleService) {}

  @Post()
  @UsePipes(new ValidationPipe({ transform: true }))
  async create(@Body() createDto: CreateMyArticleDto) {
    this.logger.log(`API [POST /my-articles] - Create - User: ${createDto.user_id}`);
    const result = await this.myArticleService.createMyArticle(createDto);
    return {
      message: 'Tạo bài viết thành công',
      data: result
    };
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async import(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: ImportMyArticlesDto
  ) {
    this.logger.log(`API [POST /my-articles/import] - User: ${body.user_id}`);
    
    if (!file) throw new BadRequestException('Vui lòng tải lên file Excel');
    if (!file.originalname.match(/\.(xlsx|xls)$/)) throw new BadRequestException('Chỉ chấp nhận file Excel (.xlsx, .xls)');

    const result = await this.myArticleService.importMyArticlesFromExcel(file, body);
    return {
      message: 'Import hoàn tất',
      stats: result
    };
  }

  // 1. Endpoint Trigger AI Enrich
  @Post('enrich')
  @UsePipes(new ValidationPipe({ transform: true }))
  async enrichArticles(@Body() enrichDto: EnrichMyArticlesDto) {
      this.logger.log(`API [POST /my-articles/enrich] - User: ${enrichDto.user_id}, UpdateID: ${enrichDto.update_id}`);
      return await this.myArticleService.enrichArticles(enrichDto);
  }

  // 2. Endpoint Get List (Phân trang & Filter)
  @Get()
  @UsePipes(new ValidationPipe({ transform: true }))
  async getArticles(@Query() query: GetMyArticlesDto) {
      this.logger.log(`API [GET /my-articles] - User: ${query.user_id}`);
      return await this.myArticleService.getMyArticles(query);
  }

  // [MỚI] 3. Endpoint Get History (Lịch sử update)
  @Get('history')
  @UsePipes(new ValidationPipe({ transform: true }))
  async getHistory(@Query() query: GetUpdateHistoryDto) {
      this.logger.log(`API [GET /my-articles/history] - User: ${query.user_id}`);
      return await this.myArticleService.getUpdateHistory(query);
  }

  // 4. Endpoint Export Excel
  @Get('export')
  @UsePipes(new ValidationPipe({ transform: true }))
  async exportArticles(@Query() query: ExportMyArticlesDto, @Res() res: Response) {
      this.logger.log(`API [GET /my-articles/export] - User: ${query.user_id}, Type: ${query.type}`);
      await this.myArticleService.exportArticles(query, res);
  }
}