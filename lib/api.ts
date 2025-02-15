import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BOT_API_URL
});

export const getWallet = async (token: string) => {
  const response = await api.get('/api/wallet', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.data;
};

export const sendTransaction = async (token: string, address: string, amount: number) => {
  const response = await api.post('/api/transaction', {
    address,
    amount
  }, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.data;
};

export const getTransactions = async (token: string) => {
  const response = await api.get('/api/transactions', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.data;
}; 