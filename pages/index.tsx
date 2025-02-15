import { useEffect, useState } from 'react';
import { Container, LoadingOverlay, Stack, Text } from '@mantine/core';
import Script from 'next/script';
import WalletCard from '../components/WalletCard';
import TransactionHistory from '../components/TransactionHistory';
import BottomNavigation from '../components/BottomNavigation';
import { initWallet, getBalance, getTransactions } from '../lib/ton';

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
        showAlert: (message: string) => void;
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
    if (typeof window !== 'undefined') {
      if (!window.Telegram?.WebApp) {
        setError('Telegram WebApp не инициализирован');
        setLoading(false);
        return;
      }

      // Расширяем веб-приложение на весь экран
      window.Telegram.WebApp.expand();
      
      // Сообщаем Telegram, что приложение готово
      window.Telegram.WebApp.ready();

      const initData = window.Telegram.WebApp.initData;
      if (!initData) {
        setError('Отсутствуют данные инициализации Telegram WebApp');
        setLoading(false);
        return;
      }

      // Инициализируем кошелек
      initWallet(initData)
        .then(async (walletData) => {
          if (!walletData) {
            throw new Error('Не удалось создать кошелек');
          }

          // Получаем баланс и транзакции
          const [balanceData, txData] = await Promise.all([
            getBalance(walletData.address),
            getTransactions(walletData.address)
          ]);

          setWallet({
            address: walletData.address,
            ...balanceData
          });
          setTransactions(txData);
        })
        .catch(err => {
          console.error('Error:', err);
          setError(err.message || 'Ошибка инициализации кошелька');
        })
        .finally(() => setLoading(false));
    }
  }, []);

  const handleSend = () => {
    window.Telegram?.WebApp?.showAlert('Функция отправки в разработке');
  };

  const handleReceive = () => {
    if (wallet) {
      navigator.clipboard.writeText(wallet.address)
        .then(() => window.Telegram?.WebApp?.showAlert('Адрес скопирован в буфер обмена'))
        .catch(() => window.Telegram?.WebApp?.showAlert('Не удалось скопировать адрес'));
    }
  };

  const handleQRCode = () => {
    window.Telegram?.WebApp?.showAlert('Функция QR-кода в разработке');
  };

  if (error) {
    return (
      <Container size="sm" py="xl">
        <Text c="red" ta="center" mb="md">Произошла ошибка</Text>
        <Text c="dimmed" size="sm" ta="center">{error}</Text>
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