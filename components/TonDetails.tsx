import { Box, Text, Stack, Group, UnstyledButton, Paper, Button, SimpleGrid, SegmentedControl } from '@mantine/core';
import { IconArrowUp, IconArrowDown, IconArrowsUpDown, IconSend, IconDownload, IconQrcode } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { LoadingOverlay } from '@mantine/core';

interface TonDetailsProps {
  balance: number;
  usdValue: number;
  address: string;
  tonPrice: number;
  priceChange: number;
  onBack: () => void;
}

interface PriceData {
  timestamp: number;
  price: number;
}

interface Transaction {
  type: 'deposit' | 'withdrawal';
  amount: number;
  address?: string;
  status: string;
  timestamp: string;
  token?: string;
}

// Маппинг интервалов на количество дней
const intervalToDays: Record<string, number> = {
  '1H': 1,
  '1D': 1,
  '1W': 7,
  '1M': 30,
  'ALL': 365
};

export function TonDetails({ balance, usdValue, address, tonPrice, priceChange: initialPriceChange, onBack }: TonDetailsProps) {
  const [selectedInterval, setSelectedInterval] = useState<string>('1H');
  const [priceData, setPriceData] = useState<PriceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [priceChange, setPriceChange] = useState(initialPriceChange);

  useEffect(() => {
    // Показываем кнопку назад в Telegram WebApp
    if (window.Telegram?.WebApp?.BackButton) {
      window.Telegram.WebApp.BackButton.show();
      window.Telegram.WebApp.BackButton.onClick(onBack);
    }

    return () => {
      // Скрываем кнопку при размонтировании компонента
      if (window.Telegram?.WebApp?.BackButton) {
        window.Telegram.WebApp.BackButton.hide();
        window.Telegram.WebApp.BackButton.onClick(() => {});
      }
    };
  }, [onBack]);

  useEffect(() => {
    const fetchPriceData = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `https://api.coingecko.com/api/v3/coins/the-open-network/market_chart?vs_currency=usd&days=${
            selectedInterval === '1H' ? '0.0417' : selectedInterval === '1D' ? '1' : selectedInterval === '1W' ? '7' : '30'
          }`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Price data:', data);

        if (!data.prices || !Array.isArray(data.prices) || data.prices.length === 0) {
          throw new Error('Invalid price data format');
        }

        const formattedData = data.prices.map(([timestamp, price]: [number, number]) => ({
          date: new Date(timestamp),
          price,
        }));

        setPriceData(formattedData);

        // Вычисляем изменение цены
        const firstPrice = formattedData[0].price;
        const lastPrice = formattedData[formattedData.length - 1].price;
        const change = ((lastPrice - firstPrice) / firstPrice) * 100;
        setPriceChange(change);

        setLoading(false);
      } catch (error) {
        console.error('Error fetching price data:', error);
        setLoading(false);
      }
    };

    fetchPriceData();
  }, [selectedInterval]);

  useEffect(() => {
    // Загрузка транзакций
    const fetchTransactions = async () => {
      try {
        const response = await fetch('/api/transactions', {
          headers: {
            'x-telegram-init-data': window.Telegram?.WebApp?.initData || ''
          }
        });
        if (response.ok) {
          const data = await response.json();
          setTransactions(data);
        }
      } catch (error) {
        console.error('Ошибка загрузки транзакций:', error);
      }
    };

    fetchTransactions();
  }, []);

  const formatDate = (timestamp: number, interval: string) => {
    const date = new Date(timestamp);
    
    if (interval === '1H') {
      return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else if (interval === '1D') {
      return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else if (interval === '1W') {
      return `${date.getDate()}.${(date.getMonth() + 1).toString().padStart(2, '0')} ${date.getHours()}:00`;
    } else {
      return `${date.getDate()}.${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    }
  };

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
              src="https://ton.org/download/ton_symbol.png" 
              alt="TON"
              style={{ width: 40, height: 40, borderRadius: '50%' }}
            />
            <div>
              <Text fw={700} size="lg">TON</Text>
              <Text size="sm" c="dimmed">The Open Network</Text>
            </div>
          </Group>
          <div style={{ textAlign: 'right' }}>
            <Text fw={700} size="lg">
              {balance.toFixed(2)} TON
            </Text>
            <Text size="sm" c="dimmed">
              {usdValue}
            </Text>
          </div>
        </Group>
      </Paper>

      {/* График цены */}
      <Paper p="md" radius="lg" style={{ 
        background: 'white',
        flex: '0 0 auto',
        height: 'min(45vh, 400px)'
      }}>
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={500}>Цена TON</Text>
            <Text fw={700} size="lg">
              {tonPrice.toFixed(2)} ₽
              <Text span c={priceChange >= 0 ? 'green' : 'red'} ml={8}>
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </Text>
            </Text>
          </Group>

          <Box style={{ height: 'calc(100% - 100px)', position: 'relative' }}>
            {loading ? (
              <LoadingOverlay visible />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={priceData}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0A84FF" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#0A84FF" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(str) => {
                      const date = new Date(str);
                      return formatDate(date.getTime(), selectedInterval);
                    }}
                    minTickGap={30}
                    tick={{ fontSize: 12, fill: '#8E8E93' }}
                  />
                  <YAxis 
                    hide 
                    domain={['dataMin', 'dataMax']}
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const value = payload[0].value as number;
                        return (
                          <Paper p="xs" radius="md" style={{ background: 'rgba(255, 255, 255, 0.95)' }}>
                            <Text fw={500}>{value.toFixed(2)} ₽</Text>
                            <Text size="xs" c="dimmed">
                              {formatDate(payload[0].payload.timestamp, selectedInterval)}
                            </Text>
                          </Paper>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke="#0A84FF"
                    strokeWidth={2}
                    fill="url(#colorPrice)"
                    animationDuration={750}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Box>

          <Group gap="xs">
            {['1H', '1D', '1W', '1M', 'ALL'].map((interval) => (
              <Button
                key={interval}
                variant={selectedInterval === interval ? 'light' : 'subtle'}
                color="blue"
                radius="xl"
                size="xs"
                onClick={() => setSelectedInterval(interval)}
                style={{ 
                  transition: 'all 0.2s ease',
                  flex: 1
                }}
              >
                {interval}
              </Button>
            ))}
          </Group>
        </Stack>
      </Paper>

      {/* История транзакций */}
      <Paper p="md" radius="lg" style={{ 
        background: 'white',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0
      }}>
        <Text fw={500} mb="md">История транзакций</Text>
        <Box style={{ 
          flex: 1, 
          overflowY: 'auto',
          minHeight: 0
        }}>
          {transactions.length === 0 ? (
            <Text c="dimmed" size="sm" ta="center">
              Транзакции отсутствуют
            </Text>
          ) : (
            <Stack gap="sm">
              {transactions.map((tx, index) => (
                <Paper
                  key={index}
                  p="sm"
                  radius="md"
                  style={{ background: 'rgba(0, 0, 0, 0.03)' }}
                >
                  <Group justify="space-between">
                    <div>
                      <Text size="sm" fw={500}>
                        {tx.type === 'deposit' ? 'Получено' : 'Отправлено'} {tx.token || 'TON'}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {new Date(tx.timestamp).toLocaleString()}
                      </Text>
                    </div>
                    <Text fw={500} c={tx.type === 'deposit' ? 'green' : 'red'}>
                      {tx.type === 'deposit' ? '+' : '-'}{tx.amount} {tx.token || 'TON'}
                    </Text>
                  </Group>
                </Paper>
              ))}
            </Stack>
          )}
        </Box>
      </Paper>
    </Box>
  );
} 