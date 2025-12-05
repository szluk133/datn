import { Controller, Get, UseGuards, Query, Post, Body, UsePipes, ValidationPipe, ParseIntPipe, Delete, Put, Param, Patch } from '@nestjs/common';
import { AdminService } from './admin.service';
import { Roles } from '../../auth/role/roles.decorator';
import { Role } from '../../auth/role/roles.enum';
import { Public } from '@/decorator/customize';
import { JwtAuthGuard } from '../../auth/passport/jwt-auth.guard'; 
import { UpdateArticleStatusDto, AdminSearchArticleDto } from './dto/admin.dto';
import { ScheduleDto } from './dto/schedule.dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard/stats')
  @Roles(Role.Admin)
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('logs')
  @Roles(Role.Admin)
  async getSystemLogs(@Query('limit') limit: number) {
    return this.adminService.getLogs(limit || 50);
  }

  @Post('schedule')
  @Roles(Role.Admin)
  @UsePipes(new ValidationPipe({ transform: true }))
  async updateCrawlSchedule(@Body() scheduleDto: ScheduleDto) {
    return this.adminService.updateCrawlSchedule(scheduleDto.minutes);
  }

  @Post('trigger-auto-crawl')
  @Roles(Role.Admin)
  async triggerAutoCrawl() {
    return this.adminService.triggerAutoCrawl();
  }
  
  @Get('articles/search')
  @Public()
  // @Roles(Role.Admin)
  @UsePipes(new ValidationPipe({ transform: true }))
  async searchArticles(@Query() query: AdminSearchArticleDto) { 
      return this.adminService.searchArticles(query); 
  }

  @Patch('articles/:id/status')
  @Roles(Role.Admin)
  async updateStatus(@Param('id') id: string, @Body() body: UpdateArticleStatusDto) { 
      return this.adminService.updateArticleStatus(id, body.status); 
  }

  @Delete('articles/:id')
  @Roles(Role.Admin)
  async deleteArticle(@Param('id') id: string) { 
      return this.adminService.deleteArticle(id); 
  }

  @Get('topics/by-website')
  // @Roles(Role.Admin)
  async getTopicsByWebsite(@Query('website') website: string) {
      return this.adminService.getTopicsByWebsite(website);
  }
  
  @Post('topics/init')
  @Roles(Role.Admin)
  async initTopics(@Query('website') website: string) {
      return this.adminService.initTopicsFromHtml(website);
  }

  @Get('articles/by-topic')
  // @Roles(Role.Admin)
  async getArticlesByTopic(
      @Query('topic') topic: string,
      @Query('website') website: string,
      @Query('page', new ParseIntPipe({ optional: true })) page: number,
      @Query('limit', new ParseIntPipe({ optional: true })) limit: number
  ) {
      return this.adminService.getArticlesByTopic(topic, website, page || 1, limit || 20);
  }
  
  @Get('system/meilisearch/stats')
  @Roles(Role.Admin)
  async getMeiliStats() { return this.adminService.getMeiliStats(); }

  @Post('system/meilisearch/sync')
  @Roles(Role.Admin)
  async syncData() { return this.adminService.syncToMeiliSearch(); }
  
  @Post('system/meilisearch/config')
  @Roles(Role.Admin)
  async configIndex() { return this.adminService.configureMeiliSearch(); }
}