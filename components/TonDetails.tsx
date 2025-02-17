import { Box, Text, Stack, Group, UnstyledButton, Paper, Button, SimpleGrid } from '@mantine/core';
import { IconArrowUp, IconArrowDown, IconArrowsUpDown, IconSend, IconDownload, IconQrcode } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { LoadingOverlay } from '@mantine/core';

interface TonDetailsProps {
  balance: number;
  usdValue: string;
  address: string;
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
}

// Маппинг интервалов на количество дней
const intervalToDays: Record<string, number> = {
  'Ч': 1,
  'Д': 7,
  'Н': 14,
  'М': 30,
  '6М': 180,
  'Г': 365
};

export default function TonDetails({
  balance,
  usdValue,
  address,
  priceChange,
  onBack
}: TonDetailsProps) {
  const [priceData, setPriceData] = useState<PriceData[]>([]);
  const [selectedInterval, setSelectedInterval] = useState<string>('1D');
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

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
        setIsLoading(true);
        const days = intervalToDays[selectedInterval];
        const response = await fetch(
          `https://api.coingecko.com/api/v3/coins/the-open-network/market_chart?vs_currency=rub&days=${days}`
        );
        const data = await response.json();
        
        // Определяем интервал между точками в зависимости от выбранного периода
        let interval = 1;
        if (days > 30) interval = 12; // каждые 12 часов
        if (days > 180) interval = 24; // каждые 24 часа

        // Прореживаем данные для оптимизации графика
        const formattedData = data.prices
          .filter((_: any, index: number) => index % interval === 0)
          .map(([timestamp, price]: [number, number]) => ({
            timestamp,
            price
          }));

        setPriceData(formattedData);
        if (formattedData.length > 0) {
          setCurrentPrice(formattedData[formattedData.length - 1].price);
        }
      } catch (error) {
        console.error('Ошибка получения данных о цене:', error);
      } finally {
        setIsLoading(false);
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
    const days = intervalToDays[interval];
    
    if (days <= 1) {
      return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else if (days <= 7) {
      return `${date.getDate()}.${(date.getMonth() + 1).toString().padStart(2, '0')} ${date.getHours()}:00`;
    } else {
      return `${date.getDate()}.${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    }
  };

  return (
    <Box style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Основная информация */}
      <Paper p="md" radius="lg" style={{ background: 'white', marginBottom: 16 }}>
        <Group justify="space-between" align="flex-start">
          <Group>
            <img 
              src="https://ton.org/download/ton_symbol.png" 
              alt="TON"
              style={{ 
                width: 48,
                height: 48,
                borderRadius: '50%'
              }}
            />
            <div>
              <Text fw={700} size="xl">TON</Text>
              <Text c="dimmed">The Open Network</Text>
            </div>
          </Group>
          <div style={{ textAlign: 'right' }}>
            <Text fw={700} size="xl">{balance.toFixed(2)}</Text>
            <Text c="dimmed">{usdValue} ₽</Text>
          </div>
        </Group>
      </Paper>

      {/* Кнопки действий */}
      <SimpleGrid cols={3} style={{ marginBottom: 16 }}>
        <Button 
          variant="light"
          color="blue"
          radius="xl"
          leftSection={<IconSend size={20} />}
          styles={{
            root: {
              height: 40
            }
          }}
        >
          Отправить
        </Button>
        <Button
          variant="light"
          color="blue"
          radius="xl"
          leftSection={<IconDownload size={20} />}
          styles={{
            root: {
              height: 40
            }
          }}
        >
          Получить
        </Button>
        <Button
          variant="light"
          color="blue"
          radius="xl"
          leftSection={<IconQrcode size={20} />}
          styles={{
            root: {
              height: 40
            }
          }}
        >
          QR-код
        </Button>
      </SimpleGrid>

      {/* График цены */}
      <Paper p="md" radius="lg" style={{ background: 'white', marginBottom: 16, flex: 1, minHeight: 0 }}>
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={500}>Цена TON</Text>
            <Text fw={700} size="xl">
              {currentPrice.toFixed(2)} ₽
              <Text span c={priceChange >= 0 ? 'green' : 'red'} ml={8}>
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </Text>
            </Text>
          </Group>

          <Box style={{ height: 180, position: 'relative' }}>
            {isLoading ? (
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
                    tickFormatter={(date) => formatDate(date, selectedInterval)}
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
                              {formatDate(payload[0].payload.date, selectedInterval)}
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
      <Paper p="md" radius="lg" style={{ background: 'white', marginBottom: 16 }}>
        <Stack gap="md">
          <Text fw={500}>История транзакций</Text>
          <Text c="dimmed" size="sm" ta="center">
            Транзакции отсутствуют
          </Text>
        </Stack>
      </Paper>
    </Box>
  );
} 