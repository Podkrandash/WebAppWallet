import { Box, Text, Paper, Stack, NumberInput, Button, Group, SegmentedControl, ActionIcon } from '@mantine/core';
import { IconArrowRight, IconArrowsExchange } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { getBalance } from '../lib/ton';

interface ExchangeProps {
  balance: number;
  usdtBalance: number;
  address: string;
  initData: string;
  onBack: () => void;
}

type CryptoType = 'TON' | 'USDT';

export default function Exchange({
  balance,
  usdtBalance,
  address,
  initData,
  onBack
}: ExchangeProps) {
  const [fromCrypto, setFromCrypto] = useState<CryptoType>('TON');
  const [toCrypto, setToCrypto] = useState<CryptoType>('USDT');
  const [amount, setAmount] = useState<number | ''>(0);
  const [exchanging, setExchanging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rate, setRate] = useState<number>(0);

  useEffect(() => {
    // Показываем кнопку назад в Telegram WebApp
    if (window.Telegram?.WebApp?.BackButton) {
      window.Telegram.WebApp.BackButton.show();
      window.Telegram.WebApp.BackButton.onClick(onBack);
    }

    return () => {
      if (window.Telegram?.WebApp?.BackButton) {
        window.Telegram.WebApp.BackButton.hide();
        window.Telegram.WebApp.BackButton.onClick(() => {});
      }
    };
  }, [onBack]);

  // Получаем курс обмена
  useEffect(() => {
    const fetchRate = async () => {
      try {
        const response = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network,tether&vs_currencies=usd'
        );
        const data = await response.json();
        const tonPrice = data['the-open-network'].usd;
        const usdtPrice = data['tether'].usd;
        setRate(tonPrice / usdtPrice);
      } catch (error) {
        console.error('Ошибка получения курса:', error);
        setRate(3.5); // Фоллбэк значение
      }
    };
    fetchRate();
  }, [fromCrypto, toCrypto]);

  const handleSwap = () => {
    const temp = fromCrypto;
    setFromCrypto(toCrypto);
    setToCrypto(temp);
    setAmount(0);
  };

  const handleExchange = async () => {
    if (!amount) {
      setError('Введите сумму');
      return;
    }

    try {
      setExchanging(true);
      setError(null);

      // TODO: Интеграция с DEX для обмена
      console.log('Обмен:', {
        from: fromCrypto,
        to: toCrypto,
        amount: amount
      });

      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert('Функция обмена находится в разработке');
      }
    } catch (error: any) {
      console.error('Ошибка обмена:', error);
      setError(error.message);
    } finally {
      setExchanging(false);
    }
  };

  const fromBalance = fromCrypto === 'TON' ? balance : usdtBalance;
  const toBalance = toCrypto === 'TON' ? balance : usdtBalance;
  const estimatedReceive = amount ? Number(amount) * (fromCrypto === 'TON' ? rate : 1/rate) : 0;

  return (
    <Box style={{ 
      height: '100vh',
      background: '#F2F2F7',
      padding: '16px'
    }}>
      <Stack gap="md">
        <Paper p="xl" radius="lg" style={{ background: 'white' }}>
          <Stack gap="xl">
            <Text size="xl" fw={700} ta="center">Обмен криптовалют</Text>

            {/* From */}
            <Stack gap="md">
              <Group justify="apart">
                <Text size="sm" fw={500}>Отдаёте</Text>
                <Text size="sm" c="dimmed">
                  Доступно: {fromBalance.toFixed(fromCrypto === 'TON' ? 2 : 6)} {fromCrypto}
                </Text>
              </Group>
              
              <Group align="flex-end" gap="sm">
                <NumberInput
                  value={amount}
                  onChange={(value) => setAmount(typeof value === 'string' ? parseFloat(value) || 0 : value)}
                  min={0}
                  max={fromBalance}
                  decimalScale={fromCrypto === 'TON' ? 2 : 6}
                  placeholder="0.00"
                  size="xl"
                  style={{ flex: 1 }}
                  styles={{
                    input: {
                      fontSize: '24px',
                      height: '56px',
                      background: 'rgba(0, 0, 0, 0.03)',
                      border: 'none',
                      borderRadius: '12px'
                    }
                  }}
                />
                <SegmentedControl
                  value={fromCrypto}
                  onChange={(value: string) => setFromCrypto(value as CryptoType)}
                  data={[
                    { label: 'TON', value: 'TON' },
                    { label: 'USDT', value: 'USDT' }
                  ]}
                />
              </Group>
            </Stack>

            {/* Swap button */}
            <Group justify="center">
              <ActionIcon 
                variant="light"
                color="blue"
                size="xl"
                onClick={handleSwap}
              >
                <IconArrowsExchange size={24} />
              </ActionIcon>
            </Group>

            {/* To */}
            <Stack gap="md">
              <Group justify="apart">
                <Text size="sm" fw={500}>Получите (примерно)</Text>
                <Text size="sm" c="dimmed">
                  Баланс: {toBalance.toFixed(toCrypto === 'TON' ? 2 : 6)} {toCrypto}
                </Text>
              </Group>
              
              <Group align="flex-end" gap="sm">
                <NumberInput
                  value={estimatedReceive}
                  readOnly
                  decimalScale={toCrypto === 'TON' ? 2 : 6}
                  placeholder="0.00"
                  size="xl"
                  style={{ flex: 1 }}
                  styles={{
                    input: {
                      fontSize: '24px',
                      height: '56px',
                      background: 'rgba(0, 0, 0, 0.03)',
                      border: 'none',
                      borderRadius: '12px'
                    }
                  }}
                />
                <SegmentedControl
                  value={toCrypto}
                  onChange={(value: string) => setToCrypto(value as CryptoType)}
                  data={[
                    { label: 'TON', value: 'TON' },
                    { label: 'USDT', value: 'USDT' }
                  ]}
                />
              </Group>
            </Stack>

            {error && (
              <Text c="red" size="sm" ta="center">
                {error}
              </Text>
            )}

            <Stack gap="md">
              <Text size="sm" c="dimmed" ta="center">
                Курс обмена: 1 TON = {rate.toFixed(2)} USDT
              </Text>

              <Button
                size="xl"
                onClick={handleExchange}
                loading={exchanging}
                leftIcon={<IconArrowsExchange size={20} />}
                styles={{
                  root: {
                    height: '56px',
                    background: '#0A84FF',
                    borderRadius: '12px',
                    '&:hover': {
                      background: '#007AFF'
                    }
                  }
                }}
              >
                Обменять
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
} 