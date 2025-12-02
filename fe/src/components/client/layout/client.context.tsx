'use client';

import React, { createContext, useState, useMemo } from 'react';
import { ISearchHistory } from '@/types/next-auth';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import localeData from 'dayjs/plugin/localeData';

dayjs.extend(customParseFormat);
dayjs.extend(localeData);

interface ClientContextType {
    searchHistory: ISearchHistory[];
    setSearchHistory: React.Dispatch<React.SetStateAction<ISearchHistory[]>>;
    isLoadingHistory: boolean;
    setIsLoadingHistory: React.Dispatch<React.SetStateAction<boolean>>;
}

export const ClientContext = createContext<ClientContextType | undefined>(undefined);

export const ClientContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [searchHistory, setSearchHistory] = useState<ISearchHistory[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);

    const contextValue = useMemo(() => ({
        searchHistory,
        setSearchHistory,
        isLoadingHistory,
        setIsLoadingHistory,
    }), [searchHistory, isLoadingHistory]);

    return (
        <ClientContext.Provider value={contextValue}>
            {children}
        </ClientContext.Provider>
    );
};
