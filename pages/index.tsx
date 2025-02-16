import { useEffect, useState } from 'react';
import { Container, LoadingOverlay, Stack, Text, Alert, Box } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import Script from 'next/script';
import WalletCard from '../components/WalletCard';
import TransactionHistory from '../components/TransactionHistory';
import BottomNavigation from '../components/BottomNavigation';
import { initWallet, getBalance, getTransactions, Transaction } from '../lib/ton';

interface WalletData {
  balance: number;
  usdValue: string;
  address: string;
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
        enableClosingConfirmation: () => void;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        BackButton: {
          onClick: (callback: () => void) => void;
          hide: () => void;
          show: () => void;
        };
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
  const [initData, setInitData] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!window.Telegram?.WebApp) {
        setError('Приложение должно быть открыто из Telegram');
        setLoading(false);
        return;
      }

      // Настраиваем внешний вид
      const webapp = window.Telegram.WebApp;
      webapp.expand(); // Разворачиваем на весь экран
      webapp.enableClosingConfirmation(); // Подтверждение закрытия
      webapp.setHeaderColor('#0A84FF'); // Цвет хедера в тон приложения
      webapp.setBackgroundColor('#F2F2F7'); // Цвет фона

      // Обработка кнопки "Назад"
      webapp.BackButton.onClick(() => {
        if (activePage === 'history') {
          setActivePage('wallet');
          webapp.BackButton.hide();
        }
      });

      webapp.ready(); // Сообщаем Telegram что приложение готово

      const webAppInitData = webapp.initData;
      if (!webAppInitData) {
        setError('Отсутствуют данные инициализации');
        setLoading(false);
        return;
      }

      setInitData(webAppInitData);

      initWallet(webAppInitData)
        .then(async (walletData) => {
          if (!walletData) {
            throw new Error('Не удалось получить данные кошелька');
          }

          try {
            const [balanceData, txData] = await Promise.all([
              getBalance(walletData.address),
              getTransactions(walletData.address)
            ]);

            setWallet({
              address: walletData.address,
              ...balanceData
            });
            setTransactions(txData);
          } catch (err) {
            setError('Ошибка при получении данных кошелька: ' + (err as Error).message);
          }
        })
        .catch(err => {
          setError('Ошибка инициализации кошелька: ' + err.message);
        })
        .finally(() => setLoading(false));
    }
  }, [activePage]);

  // Обработчик смены страницы
  const handlePageChange = (page: 'wallet' | 'history') => {
    setActivePage(page);
    if (window.Telegram?.WebApp) {
      if (page === 'history') {
        window.Telegram.WebApp.BackButton.show();
      } else {
        window.Telegram.WebApp.BackButton.hide();
      }
    }
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
      <Box 
        style={{ 
          minHeight: '100vh',
          background: '#F2F2F7'
        }}
      >
        <Box py="xl" pb={100} pos="relative">
          <LoadingOverlay visible={loading} />
          
          {activePage === 'wallet' && wallet && (
            <WalletCard
              balance={wallet.balance}
              usdValue={wallet.usdValue}
              address={wallet.address}
              initData={initData}
            />
          )}

          {activePage === 'history' && (
            <Box px="md">
              <TransactionHistory transactions={transactions} />
            </Box>
          )}
        </Box>

        <BottomNavigation
          active={activePage}
          onNavigate={handlePageChange}
        />
      </Box>
    </>
  );
} 