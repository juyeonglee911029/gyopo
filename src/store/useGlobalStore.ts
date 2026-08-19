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

interface GlobalState {
  selectedCountry: string;
  setSelectedCountry: (country: string) => void;
  
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
