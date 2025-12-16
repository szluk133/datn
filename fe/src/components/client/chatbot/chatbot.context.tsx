'use client';

import React, { createContext, useState, useContext, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/utils/api';
import { IConversation, IChatMessage, SourceDto } from '@/types/next-auth';

type ChatbotView = 'icon' | 'window' | 'full';

type PageContextType = {
    current_page: 'home_page' | 'list_page' | 'detail_page';
    search_id?: string;
    article_id?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
};

type QueryContextType = {
    context_text?: string;
};

interface ChatContextType {
    view: ChatbotView;
    setView: (view: ChatbotView) => void;
    
    currentConversationId: string | null;
    setCurrentConversationId: (id: string | null) => void;
    
    messages: IChatMessage[];
    setMessages: React.Dispatch<React.SetStateAction<IChatMessage[]>>;
    
    conversations: IConversation[];
    setConversations: React.Dispatch<React.SetStateAction<IConversation[]>>;

    isLoadingApi: boolean;
    
    loadConversations: () => Promise<void>;
    loadMessages: (conversationId: string) => Promise<void>;
    
    sendMessage: (query: string, contextOverride?: QueryContextType) => Promise<void>;
    startNewChat: () => void;
    
    setPageContext: (context: PageContextType | null) => void;
    setQueryContext: (context: QueryContextType | null) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

interface ChatApiResponse {
    answer: string;
    conversation_id: string;
    sources: SourceDto[] | null;
}

export const ChatContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { data: session } = useSession();
    const [view, setView] = useState<ChatbotView>('icon');
    const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
    const [messages, setMessages] = useState<IChatMessage[]>([]);
    const [conversations, setConversations] = useState<IConversation[]>([]);
    const [isLoadingApi, setIsLoadingApi] = useState(false);

    const [pageContext, setPageContext] = useState<PageContextType | null>(null);
    const [queryContext, setQueryContext] = useState<QueryContextType | null>(null);

    const loadConversations = async () => {
        if (!session?.user?._id) return;
        setIsLoadingApi(true);
        try {
            const res = await sendRequest<IConversation[]>({
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/chatbot/conversations/${session.user._id}`,
                method: 'GET',
                session,
            });
            if (res.data) {
                setConversations(res.data);
            }
        } catch (error) {
            console.error("Failed to load conversations:", error);
        }
        setIsLoadingApi(false);
    };

    const loadMessages = async (conversationId: string) => {
        if (!session) return;
        setIsLoadingApi(true);
        setCurrentConversationId(conversationId);
        setMessages([]); 
        try {
            const res = await sendRequest<IChatMessage[]>({
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/chatbot/messages/${conversationId}`,
                method: 'GET',
                session,
            });
            if (res.data) {
                setMessages(res.data);
            }
        } catch (error) {
            console.error("Failed to load messages:", error);
            setMessages([]);
        }
        setIsLoadingApi(false);
    };

    const sendMessage = async (query: string, contextOverride?: QueryContextType) => {
        if (!session?.user?._id) return;
        setIsLoadingApi(true);

        const contextToSend = contextOverride || queryContext;

        let userQueryDisplay = query;
        if (contextToSend?.context_text) {
            userQueryDisplay = `**Hỏi về đoạn văn bản:**\n> ${contextToSend.context_text.substring(0, 100)}...\n\n**Câu hỏi:**\n${query}`;
        }

        const userMessage: IChatMessage = {
            _id: `temp_query_${Date.now()}`,
            query: userQueryDisplay,
            answer: '...',
            created_at: new Date().toISOString(),
            sources: null, 
        };
        setMessages(prev => [...prev, userMessage]);

        const finalContext = {
            current_page: pageContext?.current_page || "home_page",
            ...pageContext,
            ...contextToSend,
        };

        const payload = {
            user_id: session.user._id,
            query: query, 
            conversation_id: currentConversationId, 
            context: finalContext
        };

        try {
            const res = await sendRequest<ChatApiResponse>({
                url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/chatbot/chat`,
                method: 'POST',
                body: payload,
                session,
            });

            if (res.data) {
                const { answer, sources, conversation_id } = res.data;

                setMessages(prev => 
                    prev.map(msg => 
                        msg._id === userMessage._id 
                        ? { 
                            ...msg, 
                            answer: answer, 
                            sources: sources ?? null,
                            _id: `msg_${Date.now()}` 
                        } 
                        : msg
                    )
                );

                if (!currentConversationId && conversation_id) {
                    setCurrentConversationId(conversation_id);
                    loadConversations();
                }

                if (contextOverride) {
                    setQueryContext(null);
                }

            } else {
                throw new Error(res.message || "API error");
            }
        } catch (error) {
            console.error("Failed to send message:", error);
            setMessages(prev => 
                prev.map(msg => 
                    msg._id === userMessage._id 
                    ? { 
                        ...msg, 
                        answer: "Lỗi: Không thể gửi tin nhắn. Vui lòng thử lại sau.", 
                        sources: null,
                        _id: `err_${Date.now()}` 
                    } 
                    : msg
                )
            );
        }
        setIsLoadingApi(false);
    };

    const startNewChat = () => {
        setCurrentConversationId(null);
        setMessages([]);
        setQueryContext(null);
    };

    const value = {
        view,
        setView,
        currentConversationId,
        setCurrentConversationId,
        messages,
        setMessages,
        conversations,
        setConversations,
        isLoadingApi,
        loadConversations,
        loadMessages,
        sendMessage,
        startNewChat,
        setPageContext,
        setQueryContext,
    };

    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    );
};

export const useChatbot = () => {
    const context = useContext(ChatContext);
    if (context === undefined) {
        throw new Error('useChatbot must be used within a ChatContextProvider');
    }
    return context;
};