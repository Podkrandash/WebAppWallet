import { Box, Text, Paper, Stack, NumberInput, Button, Group, SegmentedControl, ActionIcon } from '@mantine/core';
import { IconArrowsExchange } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { swapCrypto } from '../lib/ton';

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
  const [amount, setAmount] = useState<number | ''>(0);
  const [exchanging, setExchanging] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleExchange = async () => {
    if (!amount) {
      setError('Введите сумму');
      return;
    }

    try {
      setExchanging(true);
      setError(null);

      const isTonToToken = fromCrypto === 'TON';
      await swapCrypto(address, Number(amount), isTonToToken, initData);

      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert(
          `Обмен успешно выполнен\n\nСумма: ${amount} ${fromCrypto}\nПолучите: ${fromCrypto === 'TON' ? 'USDT' : 'TON'}`
        );
      }
      onBack();
    } catch (error: any) {
      console.error('Ошибка обмена:', error);
      setError(error.message);
      
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert('Ошибка: ' + error.message);
      }
    } finally {
      setExchanging(false);
    }
  };

  const fromBalance = fromCrypto === 'TON' ? balance : usdtBalance;
  const networkFee = 0.05;
  const dexFee = 0.01;
  const totalFee = networkFee + dexFee;

  return (
    <Box style={{ 
      height: '100vh',
      background: '#F2F2F7',
      padding: '16px'
    }}>
      <Stack gap="md">
        <Paper p="xl" radius="lg" style={{ background: 'white' }}>
          <Stack gap="xl">
            <Text size="xl" fw={700} ta="center">Обмен {fromCrypto} на {fromCrypto === 'TON' ? 'USDT' : 'TON'}</Text>

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
                  max={fromBalance - (fromCrypto === 'TON' ? totalFee : 0)}
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
                  onChange={(value: string) => {
                    setFromCrypto(value as CryptoType);
                    setAmount(0);
                  }}
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
                Комиссия сети: {networkFee} TON
                <br />
                Комиссия DEX: {dexFee} TON
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