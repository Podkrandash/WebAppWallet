import { useEffect, useState } from 'react';
import { Container, LoadingOverlay, Stack, Text, Alert, Box } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import Script from 'next/script';
import WalletCard from '../components/WalletCard';
import { initWallet, getBalance } from '../lib/ton';

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
  const [loading, setLoading] = useState(true);
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
            const balanceData = await getBalance(walletData.address);

            setWallet({
              address: walletData.address,
              ...balanceData
            });
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
  }, []);

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
        
        {wallet && (
          <WalletCard
            balance={wallet.balance}
            usdValue={wallet.usdValue}
            address={wallet.address}
            initData={initData}
          />
        )}
      </Box>
    </>
  );
} 