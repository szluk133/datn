import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Request, UsePipes, ValidationPipe, BadRequestException } from '@nestjs/common';
import { SavedArticleService } from './saved-article.service';
import { CreateSavedArticleDto } from './dto/create-saved-article.dto';
import { Public } from '@/decorator/customize';

@Controller('saved-articles')
export class SavedArticleController {
  constructor(private readonly savedArticleService: SavedArticleService) {}

  @Get()
  @Public()
  async getSavedArticles(@Request() req, @Query('page') page: number, @Query('limit') limit: number) {
    const userId = req.user?.id || req.query.user_id;
    return this.savedArticleService.getUserSavedArticles(userId, page, limit);
  }

  @Post()
  @UsePipes(new ValidationPipe({ transform: true }))
  async saveArticle(@Request() req, @Body() createDto: CreateSavedArticleDto) {
    const userId = req.user?._id || req.user?.id || createDto.user_id;

    if (!userId) {
      throw new BadRequestException("User ID is required");
    }

    return this.savedArticleService.saveArticle(userId, createDto);
  }

  @Get(':articleId/check')
  async checkSaved(@Request() req, @Param('articleId') articleId: string, @Query('user_id') queryUserId: string) {
    const userId = (req.user && req.user.id) || queryUserId;
    return this.savedArticleService.checkSavedStatus(userId, articleId);
  }

  @Delete(':articleId')
  async removeArticle(@Request() req, @Param('articleId') articleId: string, @Query('user_id') queryUserId: string) {
    const userId = (req.user && req.user.id) || queryUserId;
    return this.savedArticleService.removeArticle(userId, articleId);
  }
}