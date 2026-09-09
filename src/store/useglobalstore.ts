import { create } from 'zustand';
import { getSessionToken, saveProfile, type PortalUser } from '@/lib/firebase';

export type Transaction = {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'P2P_SEND' | 'P2P_RECEIVE' | 'FEE' | 'GAME' | 'ADS';
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'RETURNED';
  date: string;
  details: string;
};

export type PortalLanguage = 'ko' | 'en';

function storedLanguage(): PortalLanguage {
  if (typeof window === 'undefined') return 'ko';
  return window.localStorage.getItem('gyopo-language') === 'en' ? 'en' : 'ko';
}

interface GlobalState {
  selectedCountry: string;
  setSelectedCountry: (country: string) => void;
  language: PortalLanguage;
  setLanguage: (language: PortalLanguage) => void;
  darkMode: boolean;
  setDarkMode: (enabled: boolean) => void;
  
  user: PortalUser | null;
  setUser: (user: GlobalState['user']) => void;
  updateUsdt: (amount: number, txDetails?: Omit<Transaction, 'id' | 'date'>) => void;
  subscribe: () => void;
  
  transactions: Transaction[];
  addTransaction: (tx: Omit<Transaction, 'id' | 'date'>) => void;
}

export const useGlobalStore = create<GlobalState>((set) => ({
  selectedCountry: 'Global',
  setSelectedCountry: (country) => set({ selectedCountry: country }),
  language: storedLanguage(),
  setLanguage: (language) => {
    if (typeof window !== 'undefined') window.localStorage.setItem('gyopo-language', language);
    set({ language });
  },
  darkMode: true,
  setDarkMode: (enabled) => set({ darkMode: enabled }),
  
  user: null,
  setUser: (user) => set({ user }),
  subscribe: () => {
    let nextUser: PortalUser | null = null;
    set((state) => {
      if (!state.user) return state;
      nextUser = { ...state.user, isSubscribed: true };
      return { user: nextUser };
    });
    if (nextUser) void saveProfile(nextUser, getSessionToken());
  },
  
  transactions: [],
  
  addTransaction: (tx) => set((state) => ({
    transactions: [
      {
        ...tx,
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toLocaleString(),
      },
      ...state.transactions
    ]
  })),

  updateUsdt: (amount, txDetails) => {
    let nextUser: PortalUser | null = null;
    set((state) => {
      if (!state.user) return state;

      const newTransactions = txDetails ? [
        {
          ...txDetails,
          id: Math.random().toString(36).substr(2, 9),
          date: new Date().toLocaleString(),
        },
        ...state.transactions
      ] : state.transactions;

      nextUser = { ...state.user, usdtBalance: state.user.usdtBalance + amount };
      return {
        user: nextUser,
        transactions: newTransactions,
      };
    });
    if (nextUser) void saveProfile(nextUser, getSessionToken());
  },
}));
