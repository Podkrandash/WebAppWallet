import { useEffect, useState } from 'react';
import { Container, LoadingOverlay, Stack, Text, Alert } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
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
        close: () => void;
        sendData: (data: string) => void;
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
        console.error('Telegram WebApp не инициализирован');
        setError('Приложение должно быть открыто из Telegram');
        setLoading(false);
        return;
      }

      // Расширяем веб-приложение на весь экран
      window.Telegram.WebApp.expand();
      
      // Сообщаем Telegram, что приложение готово
      window.Telegram.WebApp.ready();

      const initData = window.Telegram.WebApp.initData;
      console.log('Raw initData:', initData); // Добавляем логирование raw initData

      // Декодируем initData
      try {
        const params = new URLSearchParams(initData);
        console.log('Parsed initData params:', {
          user: params.get('user'),
          auth_date: params.get('auth_date'),
          hash: params.get('hash')
        });
      } catch (e) {
        console.error('Error parsing initData:', e);
      }

      if (!initData) {
        console.error('Отсутствует initData');
        setError('Отсутствуют данные инициализации Telegram WebApp');
        setLoading(false);
        return;
      }

      console.log('InitData:', initData); // Добавляем для отладки

      // Инициализируем кошелек
      initWallet(initData)
        .then(async (walletData) => {
          if (!walletData) {
            console.error('Wallet data is null');
            throw new Error('Не удалось получить данные кошелька');
          }

          console.log('Wallet data:', walletData); // Добавляем для отладки

          try {
            // Получаем баланс и транзакции
            const [balanceData, txData] = await Promise.all([
              getBalance(walletData.address),
              getTransactions(walletData.address)
            ]);

            console.log('Balance data:', balanceData); // Добавляем для отладки
            console.log('Transaction data:', txData); // Добавляем для отладки

            setWallet({
              address: walletData.address,
              ...balanceData
            });
            setTransactions(txData);
          } catch (err) {
            console.error('Error fetching wallet data:', err);
            setError('Ошибка при получении данных кошелька: ' + (err as Error).message);
          }
        })
        .catch(err => {
          console.error('Initialization error:', err);
          setError('Ошибка инициализации кошелька: ' + err.message);
          // Убираем автоматическое закрытие
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
        <Alert icon={<IconAlertCircle size={16} />} title="Ошибка" color="red">
          {error}
        </Alert>
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