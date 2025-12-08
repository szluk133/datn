import NextAuth, { DefaultSession, DefaultUser } from "next-auth";
import { JWT } from "next-auth/jwt";

export interface IArticle {
    id: string;
    _id: string;
    title: string;
    summary: string;
    website: string;
    publish_date: string;
    url: string;
    content?: string;
    ai_sentiment_score?: number;
    site_categories?: string[];
    ai_summary?: string[];
    status: 'visible' | 'hidden' | 'spam';
}

export interface IMeta {
    current: number;
    pageSize: number;
    pages: number;
    total: number;
}

export interface ISearchHistory {
    _id: string;
    search_id: string;
    keyword_search: string;
    keyword_content: string;
    time_range: string;
    websites_crawled: string[];
    created_at?: string;
    timestamp?: number;
}
export interface IUser {
    _id: string;
    name: string;
    email: string;
    role: string;
}

// CHATBOT
export interface SourceDto {
    article_id: string;
    title: string;
    answer_part: string | null;
}

export interface IChatMessage {
    _id: string;
    query: string;
    answer: string;
    created_at: string;
    sources: SourceDto[] | null;
}

export interface IConversation {
    conversation_id: string;
    created_at: string;
    title: string;
}

// ADMIN
export interface IAdminStats {
    totalArticles: number;
    topSources: { _id: string; count: number }[];
    sentiment: {
        avgSentiment: number;
        positive: number;
        negative: number;
    };
    crawledToday: number;
}

export interface IKeywordTrend {
    keyword: string;
    count: number;
    lastSearched: string;
}

export interface ISentimentTrend {
    date: string;
    avgSentiment: number;
    totalArticles: number;
    breakdown: {
        positive: number;
        negative: number;
        neutral: number;
    };
}

export interface ISystemLog {
    _id: string;
    action: string;
    level: "INFO" | "ERROR" | "WARN";
    user_id: string;
    details: any;
    timestamp: string;
}

export interface ISourceSentiment {
    source: string;
    avgSentiment: number;
    total: number;
    breakdown: {
        positive: number;
        negative: number;
        neutral: number;
    };
}

export interface ICategoryDistribution {
    category: string;
    count: number;
    percentage: number;
}

export interface IAdminArticle {
    id: string; 
    _id: string; 
    title: string;
    summary: string;
    website: string;
    publish_date: string;
    url: string;
    ai_sentiment_score: number;
    site_categories: string[];
    status: 'visible' | 'hidden' | 'spam';
}

export interface ITopic {
    _id: string;
    name: string;
    website: string;
    slug?: string;
}

// AUTHENTICATION

declare module "next-auth" {
    interface Session {
        user: IUser & DefaultSession["user"];
        access_token: string;
    }
    interface User extends DefaultUser {
        _id: string;
        role: string;
        access_token: string;
    }
}

declare module "next-auth/jwt" {

    interface JWT {
        user: IUser;
        access_token: string;
    }
}