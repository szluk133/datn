import { Controller, Post, Body, Get, Param, UsePipes, ValidationPipe, Query, Logger, NotFoundException, Res, Sse, MessageEvent } from '@nestjs/common';
import { ArticleService, CrawlStatusResponse } from './article.service';
import { CrawlRequestDto, CrawlTriggerResponseDto } from './dto/crawl-request';
import { SearchHistoryResponseDto } from './dto/search-history';
import { Article } from './schemas/article.schema';
import { PaginationParamsDto, PaginatedArticleResponse } from './dto/pagination.dto';
import { WebsiteResponseDto } from './dto/website.response.dto';
import { SearchResponseDto } from './dto/search-response.dto';
import { ExportSelectedDto } from './dto/export-selected.dto';
import type { Response } from 'express';
import { Public } from '@/decorator/customize';
import { Observable } from 'rxjs';

@Controller('article')
export class ArticleController {
  private readonly logger = new Logger(ArticleController.name);

  constructor(private readonly articleService: ArticleService) {}

  @Post('crawl')
  @Public()
  @UsePipes(new ValidationPipe({ transform: true }))
  async triggerCrawl(@Body() crawlDto: CrawlRequestDto): Promise<CrawlTriggerResponseDto> {
    this.logger.log(`API [POST /article/crawl] - User: ${crawlDto.user_id} - Keywords: ${crawlDto.keyword_search}`);
    return this.articleService.triggerCrawlManual(crawlDto);
  }

  @Sse('stream-status/:searchId')
  streamCrawlStatus(@Param('searchId') searchId: string): Observable<MessageEvent> {
    this.logger.log(`API [SSE /article/stream-status/:searchId] - Connection opened for SearchID: ${searchId}`);
    return this.articleService.subscribeToCrawlStatus(searchId);
  }

  // Lấy danh sách website
  @Get('websites')
  async getAllWebsites(): Promise<WebsiteResponseDto[]> {
    this.logger.log(`API [GET /article/websites]`);
    return this.articleService.getAllWebsites();
  }

  // Kiểm tra trạng thái crawl
  @Get('status/:searchId')
  async getCrawlStatus(@Param('searchId') searchId: string): Promise<CrawlStatusResponse> {
    this.logger.log(`API [GET /article/status/:searchId] - SearchID: ${searchId}`);
    return this.articleService.getCrawlStatus(searchId);
  }

  @Get('export/:searchId')
  async exportArticles(
    @Param('searchId') searchId: string,
    @Res() res: Response, 
  ) {
    this.logger.log(`API [GET /article/export/:searchId] - SearchID: ${searchId}`);
    const buffer = await this.articleService.exportBySearchId(searchId);
    this.sendExcelResponse(res, buffer, `Export_Search_${searchId}.xlsx`);
  }

  @Get('export/word/:articleId')
  async exportArticleWord(
    @Param('articleId') articleId: string,
    @Res() res: Response,
  ) {
    this.logger.log(`API [GET /article/export/word/:articleId] - ID: ${articleId}`);
    const buffer = await this.articleService.exportArticleToWord(articleId);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=Article_${articleId}.docx`);
    res.send(buffer);
  }
  
  //EXPORT SELECTED
  @Post('export/selected')
  @UsePipes(new ValidationPipe({ transform: true }))
  async exportSelected(
    @Body() dto: ExportSelectedDto,
    @Res() res: Response,
  ) {
    this.logger.log(`API [POST /article/export/selected] - Count: ${dto.articleIds.length}`);
    const buffer = await this.articleService.exportSelectedArticles(dto.articleIds);
    this.sendExcelResponse(res, buffer, `Export_Selected_${Date.now()}.xlsx`);
  }

  private sendExcelResponse(res: Response, buffer: Buffer, fileName: string) {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.send(buffer);
  }

  // Tìm kiếm bài báo (Legacy hoặc dùng cho search nội bộ DB)
  @Post('search')
  @UsePipes(new ValidationPipe({ transform: true }))
  async searchAndFetch(
    @Body() crawlDto: CrawlRequestDto,
    @Query() pagination: PaginationParamsDto,
  ): Promise<SearchResponseDto> {
    this.logger.log(`API [POST /article/search] - User: ${crawlDto.user_id}`);
    return this.articleService.searchAndFetchArticles(crawlDto, pagination);
  }

  // Lấy lịch sử tìm kiếm
  @Get('history/:userId')
  @Public()
  async getSearchHistory(@Param('userId') userId: string): Promise<SearchHistoryResponseDto[]> {
    this.logger.log(`API [GET /article/history/:userId] - User: ${userId}`);
    return this.articleService.getSearchHistoryByUserId(userId);
  }

  // Lấy bài báo từ lịch sử
  @Get('search-history/:searchId')
  @Public()
  async getArticlesFromHistory(
    @Param('searchId') searchId: string,
    @Query() pagination: PaginationParamsDto,
  ): Promise<PaginatedArticleResponse> {
    this.logger.log(`API [GET /article/search-history/:searchId] - SearchID: ${searchId}`);
    return this.articleService.getArticlesBySearchId(searchId, pagination);
  }

  // Lấy chi tiết bài báo
  @Get(':articleId')
  async getArticleDetail(@Param('articleId') articleId: string): Promise<Article> {
    this.logger.log(`API [GET /article/:articleId] - ID: ${articleId}`);
    const article = await this.articleService.getArticleDetailById(articleId);
    if (!article) {
      throw new NotFoundException(`Article with ID ${articleId} not found`);
    }
    return article;
  }
}