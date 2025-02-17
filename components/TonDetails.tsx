import { Box, Text, Stack, Group, UnstyledButton, Paper } from '@mantine/core';
import { IconArrowUp, IconArrowDown, IconArrowsUpDown } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

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
  const [selectedInterval, setSelectedInterval] = useState<string>('М');
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
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

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const days = intervalToDays[selectedInterval];
    
    if (days <= 1) {
      return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else if (days <= 7) {
      return `${date.getDate()}.${(date.getMonth() + 1).toString().padStart(2, '0')} ${date.getHours()}:00`;
    } else {
      return `${date.getDate()}.${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    }
  };

  return (
    <Box style={{ 
      height: '100vh', 
      background: '#F2F2F7',
      color: '#000',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Хедер */}
      <Paper 
        p="md"
        radius={0}
        style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.1)'
        }}
      >
        <Group justify="space-between">
          <Box w={40} />
          <Text fw={600} size="lg">TON</Text>
          <Box w={40} />
        </Group>
      </Paper>

      {/* Основной баланс */}
      <Paper
        radius="lg"
        p="xl"
        style={{
          background: 'white',
          margin: '16px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
        }}
      >
        <Stack align="center" gap="xs">
          <Box 
            style={{ 
              width: 48, 
              height: 48, 
              borderRadius: '50%',
              overflow: 'hidden',
              marginBottom: 8,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
            }}
          >
            <img 
              src="https://ton.org/download/ton_symbol.png" 
              alt="TON"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </Box>
          <Text size="xl" fw={700}>{balance.toFixed(8)} TON</Text>
          <Text c="dimmed">{usdValue} ₽</Text>
        </Stack>
      </Paper>

      {/* Кнопки действий */}
      <Group grow px="md" pb={24}>
        <UnstyledButton>
          <Stack align="center" gap={4}>
            <Box 
              style={{ 
                width: 40, 
                height: 40, 
                borderRadius: '50%',
                background: '#0A84FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                boxShadow: '0 2px 8px rgba(10, 132, 255, 0.3)'
              }}
            >
              <IconArrowUp size={20} />
            </Box>
            <Text size="sm" fw={500}>Отправить</Text>
          </Stack>
        </UnstyledButton>

        <UnstyledButton>
          <Stack align="center" gap={4}>
            <Box 
              style={{ 
                width: 40, 
                height: 40, 
                borderRadius: '50%',
                background: '#0A84FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                boxShadow: '0 2px 8px rgba(10, 132, 255, 0.3)'
              }}
            >
              <IconArrowDown size={20} />
            </Box>
            <Text size="sm" fw={500}>Получить</Text>
          </Stack>
        </UnstyledButton>

        <UnstyledButton>
          <Stack align="center" gap={4}>
            <Box 
              style={{ 
                width: 40, 
                height: 40, 
                borderRadius: '50%',
                background: '#0A84FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                boxShadow: '0 2px 8px rgba(10, 132, 255, 0.3)'
              }}
            >
              <IconArrowsUpDown size={20} />
            </Box>
            <Text size="sm" fw={500}>Обменять</Text>
          </Stack>
        </UnstyledButton>
      </Group>

      {/* Информация о цене */}
      <Paper 
        p="xl" 
        radius="lg" 
        style={{ 
          background: 'white',
          margin: '0 16px 16px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
        }}
      >
        <Group justify="space-between">
          <Text c="dimmed" fw={500}>Цена TON</Text>
          <Stack gap={4} align="flex-end">
            <Text fw={600}>{currentPrice.toFixed(2)} ₽</Text>
            <Text 
              size="sm" 
              fw={500}
              c={priceChange >= 0 ? '#34C759' : '#FF3B30'}
            >
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
            </Text>
          </Stack>
        </Group>
      </Paper>

      {/* График */}
      <Paper 
        radius="lg"
        style={{ 
          height: 180, 
          margin: '0 16px 16px',
          background: 'white',
          padding: '16px 0',
          opacity: isLoading ? 0.5 : 1,
          transition: 'opacity 0.3s ease',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={priceData}>
            <defs>
              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0A84FF" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#0A84FF" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={formatDate}
              stroke="#999"
              tick={{ fill: '#999' }}
              axisLine={{ stroke: '#eee' }}
              minTickGap={30}
            />
            <YAxis 
              stroke="#999"
              tick={{ fill: '#999' }}
              axisLine={{ stroke: '#eee' }}
              tickFormatter={(value) => `${value.toFixed(0)}₽`}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{ 
                background: 'white',
                border: '1px solid #eee',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
              }}
              labelFormatter={formatDate}
              formatter={(value: number) => [`${value.toFixed(2)}₽`, 'Цена']}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke="#0A84FF"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorPrice)"
              isAnimationActive={!isLoading}
              animationDuration={750}
              animationEasing="ease-in-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Paper>

      {/* Временные интервалы */}
      <Paper
        radius="lg"
        p="xs"
        style={{
          background: 'white',
          margin: '0 16px 16px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
        }}
      >
        <Group grow>
          {Object.keys(intervalToDays).map((interval) => (
            <UnstyledButton 
              key={interval}
              style={{
                padding: '8px',
                borderRadius: '8px',
                background: interval === selectedInterval ? '#0A84FF' : 'transparent',
                transition: 'all 0.2s ease'
              }}
              onClick={() => setSelectedInterval(interval)}
            >
              <Text 
                size="sm"
                align="center"
                fw={500}
                c={interval === selectedInterval ? 'white' : 'dimmed'}
                style={{ transition: 'color 0.2s ease' }}
              >
                {interval}
              </Text>
            </UnstyledButton>
          ))}
        </Group>
      </Paper>

      {/* История транзакций */}
      <Box style={{ flex: 1, position: 'relative' }}>
        <Paper 
          radius="lg" 
          p="xl"
          style={{ 
            background: 'white',
            position: 'absolute',
            bottom: 0,
            left: 16,
            right: 16,
            paddingBottom: 32,
            boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.05)'
          }}
        >
          {transactions.length === 0 ? (
            <Stack align="center" pt={48} pb={24}>
              <Text c="dimmed" fw={500}>История транзакций пуста</Text>
            </Stack>
          ) : (
            <Stack>
              <Text fw={600} size="lg" mb={16}>История</Text>
              <Paper
                p="md"
                radius="lg"
                style={{ 
                  background: '#F8F9FA',
                  border: '1px solid #eee'
                }}
              >
                <Group justify="apart">
                  <Group>
                    <Box 
                      style={{ 
                        width: 40, 
                        height: 40, 
                        borderRadius: '50%',
                        background: '#0A84FF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white'
                      }}
                    >
                      <IconArrowUp size={20} />
                    </Box>
                    <Stack gap={4}>
                      <Text fw={500}>Отправлено</Text>
                      <Text size="sm" c="dimmed">UQDV...cN3I</Text>
                      <Text size="sm" c="#FF9500" fw={500}>Неуспешно</Text>
                    </Stack>
                  </Group>
                  <Stack align="flex-end" gap={4}>
                    <Text fw={500}>-0.01 TON</Text>
                    <Text size="sm" c="dimmed">08:57</Text>
                  </Stack>
                </Group>
              </Paper>
            </Stack>
          )}
        </Paper>
      </Box>
    </Box>
  );
} 