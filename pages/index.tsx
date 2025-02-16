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
      // Проверяем доступность Telegram Web App
      if (!window.Telegram?.WebApp) {
        console.error('Telegram WebApp не найден');
        setError('Приложение должно быть открыто из Telegram');
        setLoading(false);
        return;
      }

      // Настраиваем внешний вид
      const webapp = window.Telegram.WebApp;
      
      try {
        webapp.enableClosingConfirmation();
        webapp.setHeaderColor('#0A84FF');
        webapp.setBackgroundColor('#F2F2F7');
        // Предотвращаем сворачивание при скролле
        document.body.style.overscrollBehavior = 'none';
        document.documentElement.style.overscrollBehavior = 'none';
        // Предотвращаем горизонтальный скролл
        document.body.style.overflowX = 'hidden';
        document.documentElement.style.overflowX = 'hidden';
      } catch (e) {
        console.error('Ошибка настройки внешнего вида:', e);
      }

      // Обработка кнопки "Назад"
      webapp.BackButton.onClick(() => {
        if (activePage === 'history') {
          setActivePage('wallet');
          webapp.BackButton.hide();
        }
      });

      try {
        webapp.ready();
      } catch (e) {
        console.error('Ошибка вызова ready():', e);
      }

      const webAppInitData = webapp.initData;
      if (!webAppInitData) {
        console.error('Отсутствуют данные инициализации');
        setError('Отсутствуют данные инициализации');
        setLoading(false);
        return;
      }

      console.log('Получены данные инициализации:', webAppInitData);
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
            console.error('Ошибка при получении данных кошелька:', err);
            setError('Ошибка при получении данных кошелька: ' + (err as Error).message);
          }
        })
        .catch(err => {
          console.error('Ошибка инициализации кошелька:', err);
          setError('Ошибка инициализации кошелька: ' + err.message);
        })
        .finally(() => setLoading(false));
    }
  }, [activePage]);

  // Обработчик смены страницы
  const handlePageChange = (page: 'wallet' | 'history') => {
    setActivePage(page);
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
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
      <Script 
        src="https://telegram.org/js/telegram-web-app.js" 
        strategy="beforeInteractive"
        onError={(e) => {
          console.error('Ошибка загрузки Telegram Web App:', e);
          setError('Ошибка загрузки Telegram Web App');
        }}
      />
      <Box 
        style={{ 
          height: '100vh',
          background: '#F2F2F7',
          overflowY: 'auto'
        }}
      >
        <LoadingOverlay visible={loading} />
        
        {activePage === 'wallet' && wallet && (
          <>
            <WalletCard
              balance={wallet.balance}
              usdValue={wallet.usdValue}
              address={wallet.address}
              initData={initData}
            />
            <BottomNavigation
              active={activePage}
              onNavigate={handlePageChange}
            />
          </>
        )}

        {activePage === 'history' && (
          <>
            <Box px="md">
              <TransactionHistory transactions={transactions} />
            </Box>
            <BottomNavigation
              active={activePage}
              onNavigate={handlePageChange}
            />
          </>
        )}
      </Box>
    </>
  );
} 