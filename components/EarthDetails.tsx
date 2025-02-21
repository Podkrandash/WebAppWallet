import { Box, Text, Paper, Stack, Group, SegmentedControl, Skeleton } from '@mantine/core';
import { useState, useEffect } from 'react';
import { getTransactions } from '../lib/ton';
import { Transaction } from '../lib/ton';

interface EarthDetailsProps {
  earthBalance: number;
  address: string;
  onBack: () => void;
}

interface PriceData {
  date: Date;
  price: number;
}

// Маппинг интервалов на количество дней
const intervalToDays: Record<string, number> = {
  '1H': 1,
  '1D': 1,
  '1W': 7,
  '1M': 30,
  'ALL': 365
};

export default function EarthDetails({
  earthBalance,
  address,
  onBack
}: EarthDetailsProps) {
  const [selectedInterval, setSelectedInterval] = useState<string>('1D');
  const [transactions, setTransactions] = useState<Transaction[]>([]);

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

  useEffect(() => {
    // Загрузка транзакций
    const fetchTransactions = async () => {
      try {
        const data = await getTransactions(address);
        setTransactions(data.filter(tx => tx.token === 'EARTH'));
      } catch (error) {
        console.error('Ошибка загрузки транзакций:', error);
      }
    };

    fetchTransactions();
  }, [address]);

  return (
    <Box style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      padding: '16px',
      gap: '12px',
      background: '#F2F2F7'
    }}>
      {/* Основная информация */}
      <Paper p="md" radius="lg" style={{ background: 'white' }}>
        <Group justify="space-between" align="flex-start">
          <Group>
            <img 
              src="/earth-token-logo.png"
              alt="EARTH"
              style={{ 
                width: 40,
                height: 40,
                borderRadius: '50%'
              }}
            />
            <div>
              <Text fw={700} size="lg">EARTH</Text>
              <Text size="sm" c="dimmed">Earth Token</Text>
            </div>
          </Group>
          <div style={{ textAlign: 'right' }}>
            <Text fw={700} size="lg">{earthBalance.toFixed(2)} EARTH</Text>
            <Text size="sm" c="dimmed">{earthBalance.toFixed(2)} ₽</Text>
          </div>
        </Group>
      </Paper>

      {/* История транзакций */}
      <Paper p="md" radius="lg" style={{ background: 'white', flex: 1 }}>
        <Stack gap="md">
          <Text fw={500}>История транзакций</Text>
          
          {transactions.length > 0 ? (
            <Stack gap="sm">
              {transactions.map((tx) => (
                <Paper
                  key={tx.id}
                  p="sm"
                  radius="md"
                  style={{
                    background: 'rgba(0, 0, 0, 0.03)'
                  }}
                >
                  <Group justify="space-between">
                    <div>
                      <Text size="sm" fw={500}>
                        {tx.type === 'WITHDRAWAL' ? 'Отправлено' : 'Получено'}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {new Date(tx.timestamp).toLocaleString()}
                      </Text>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <Text size="sm" fw={500}>
                        {tx.type === 'WITHDRAWAL' ? '-' : '+'}{tx.amount} EARTH
                      </Text>
                      <Text size="xs" c="dimmed">
                        Комиссия: {tx.fee} TON
                      </Text>
                    </div>
                  </Group>
                </Paper>
              ))}
            </Stack>
          ) : (
            <Text c="dimmed" ta="center">Нет транзакций</Text>
          )}
        </Stack>
      </Paper>
    </Box>
  );
} 