import { create } from 'zustand';

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
  
  user: {
    id: string;
    name: string;
    email: string;
    image: string;
    usdtBalance: number;
    isSubscribed: boolean;
  } | null;
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
  subscribe: () => set((state) => ({ user: state.user ? { ...state.user, isSubscribed: true } : null })),
  
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

  updateUsdt: (amount, txDetails) => set((state) => {
    if (!state.user) return state;
    
    // Add transaction history if details provided
    const newTransactions = txDetails ? [
      {
        ...txDetails,
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toLocaleString(),
      },
      ...state.transactions
    ] : state.transactions;

    return {
      user: { ...state.user, usdtBalance: state.user.usdtBalance + amount },
      transactions: newTransactions
    };
  }),
}));
