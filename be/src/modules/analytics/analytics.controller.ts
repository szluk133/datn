import { Controller, Get, Query, ParseIntPipe } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { Public } from '@/decorator/customize';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('trend/keywords')
  async getHotKeywords(
    @Query('days', new ParseIntPipe({ optional: true })) days?: number
  ) {
    return this.analyticsService.getHotKeywords(days || 7);
  }

  @Get('trend/sentiment-over-time')
  async getSentimentOverTime(
    @Query('days', new ParseIntPipe({ optional: true })) days?: number,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.analyticsService.getSentimentTrend(days, fromDate, toDate);
  }

  @Get('report/summary')
  async getSummaryReport() {
    return this.analyticsService.getSummaryReport();
  }

  @Get('sources/sentiment')
  async getSourceSentiment() {
    return this.analyticsService.getSourceSentimentComparison();
  }

  @Get('categories/distribution')
  async getCategoriesDistribution() {
    return this.analyticsService.getCategoryDistribution();
  }
}