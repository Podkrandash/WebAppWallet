import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
});

export const getWallet = async (initData: string) => {
  const response = await api.get('/api/wallet', {
    headers: {
      'X-Telegram-Init-Data': initData
    }
  });
  return response.data;
};

export const getTransactions = async (initData: string) => {
  const response = await api.get('/api/transactions', {
    headers: {
      'X-Telegram-Init-Data': initData
    }
  });
  return response.data;
};

export const sendTransaction = async (initData: string, address: string, amount: number) => {
  const response = await api.post('/api/transaction', {
    address,
    amount
  }, {
    headers: {
      'X-Telegram-Init-Data': initData
    }
  });
  return response.data;
}; 