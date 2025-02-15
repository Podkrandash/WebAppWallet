import { useEffect, useState } from 'react';
import { Container, LoadingOverlay, Stack, Text } from '@mantine/core';
import Script from 'next/script';
import WalletCard from '../components/WalletCard';
import TransactionHistory from '../components/TransactionHistory';
import BottomNavigation from '../components/BottomNavigation';
import { getWallet, getTransactions } from '../lib/api';

interface WalletData {
  balance: number;
  usdValue: string;
  address: string;
}

interface Transaction {
  type: 'deposit' | 'withdrawal';
  amount: number;
  fromCurrency: string;
  status: string;
  timestamp: string;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        ready: () => void;
        expand: () => void;
      };
    };
  }
}

export default function Home() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState<'wallet' | 'history'>('wallet');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      // Расширяем веб-приложение на весь экран
      window.Telegram.WebApp.expand();
      
      // Сообщаем Telegram, что приложение готово
      window.Telegram.WebApp.ready();

      const initData = window.Telegram.WebApp.initData;
      if (initData) {
        Promise.all([
          getWallet(initData),
          getTransactions(initData)
        ])
          .then(([walletData, txData]) => {
            setWallet(walletData);
            setTransactions(txData);
          })
          .catch(err => {
            console.error('Error fetching data:', err);
            setError('Ошибка загрузки данных');
          })
          .finally(() => setLoading(false));
      } else {
        setError('Ошибка инициализации Telegram WebApp');
        setLoading(false);
      }
    }
  }, []);

  const handleSend = () => {
    // TODO: Implement send functionality
    console.log('Send clicked');
  };

  const handleReceive = () => {
    // TODO: Implement receive functionality
    console.log('Receive clicked');
  };

  const handleQRCode = () => {
    // TODO: Implement QR code functionality
    console.log('QR code clicked');
  };

  if (error) {
    return (
      <Container size="sm" py="xl">
        <Text c="red" ta="center">{error}</Text>
      </Container>
    );
  }

  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <Container size="sm" py="xl" pb={80} pos="relative">
        <LoadingOverlay visible={loading} />
        
        <Stack gap="xl">
          {activePage === 'wallet' && wallet && (
            <WalletCard
              balance={wallet.balance}
              usdValue={wallet.usdValue}
              address={wallet.address}
              onSend={handleSend}
              onReceive={handleReceive}
              onQRCode={handleQRCode}
            />
          )}

          {activePage === 'history' && (
            <TransactionHistory transactions={transactions} />
          )}
        </Stack>

        <BottomNavigation
          active={activePage}
          onNavigate={setActivePage}
        />
      </Container>
    </>
  );
} 