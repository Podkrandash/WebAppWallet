import { Box, Text, Stack, Group, UnstyledButton, Paper } from '@mantine/core';
import { IconArrowUp, IconArrowDown, IconArrowsUpDown } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from 'recharts';

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
        // Получаем данные о цене за последний месяц
        const response = await fetch(
          'https://api.coingecko.com/api/v3/coins/the-open-network/market_chart?vs_currency=rub&days=30'
        );
        const data = await response.json();
        
        // Форматируем данные для графика
        const formattedData = data.prices.map(([timestamp, price]: [number, number]) => ({
          timestamp,
          price
        }));

        setPriceData(formattedData);
        if (formattedData.length > 0) {
          setCurrentPrice(formattedData[formattedData.length - 1].price);
        }
      } catch (error) {
        console.error('Ошибка получения данных о цене:', error);
      }
    };

    fetchPriceData();
  }, []);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getDate()}.${date.getMonth() + 1}`;
  };

  return (
    <Box style={{ height: '100vh', background: '#17181C', color: 'white' }}>
      {/* Хедер */}
      <Group justify="space-between" p="md">
        <Box w={40} />
        <Text fw={500}>Toncoin</Text>
        <Box w={40} />
      </Group>

      {/* Основной баланс */}
      <Stack align="center" pt={32} pb={48}>
        <Box 
          style={{ 
            width: 64, 
            height: 64, 
            borderRadius: '50%',
            overflow: 'hidden',
            marginBottom: 16
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

      {/* Кнопки действий */}
      <Group grow px="md" pb={32}>
        <UnstyledButton>
          <Stack align="center" gap={8}>
            <Box 
              style={{ 
                width: 48, 
                height: 48, 
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <IconArrowUp size={24} />
            </Box>
            <Text>Отправить</Text>
          </Stack>
        </UnstyledButton>

        <UnstyledButton>
          <Stack align="center" gap={8}>
            <Box 
              style={{ 
                width: 48, 
                height: 48, 
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <IconArrowDown size={24} />
            </Box>
            <Text>Получить</Text>
          </Stack>
        </UnstyledButton>

        <UnstyledButton>
          <Stack align="center" gap={8}>
            <Box 
              style={{ 
                width: 48, 
                height: 48, 
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <IconArrowsUpDown size={24} />
            </Box>
            <Text>Обменять</Text>
          </Stack>
        </UnstyledButton>
      </Group>

      {/* Информация о цене */}
      <Paper 
        p="md" 
        radius="md" 
        style={{ 
          background: 'rgba(255, 255, 255, 0.05)',
          margin: '0 16px'
        }}
      >
        <Stack>
          <Group justify="space-between">
            <Text c="dimmed">Цена</Text>
            <Stack gap={4} align="flex-end">
              <Text>{currentPrice.toFixed(2)} ₽</Text>
              <Text size="sm" c={priceChange >= 0 ? 'green' : 'red'}>
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </Text>
            </Stack>
          </Group>
        </Stack>
      </Paper>

      {/* График */}
      <Box 
        style={{ 
          height: 200, 
          margin: '24px 16px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: 12,
          padding: '16px 0'
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={priceData}>
            <defs>
              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0088FE" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#0088FE" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={formatDate}
              stroke="#666"
              tick={{ fill: '#666' }}
              axisLine={{ stroke: '#333' }}
            />
            <YAxis 
              stroke="#666"
              tick={{ fill: '#666' }}
              axisLine={{ stroke: '#333' }}
              tickFormatter={(value) => `${value.toFixed(0)}₽`}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke="#0088FE"
              fillOpacity={1}
              fill="url(#colorPrice)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Box>

      {/* Временные интервалы */}
      <Group grow px="md">
        {['Ч', 'Д', 'Н', 'М', '6М', 'Г'].map((interval) => (
          <UnstyledButton 
            key={interval}
            style={{
              padding: '8px',
              borderRadius: '8px',
              background: interval === selectedInterval ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
            }}
            onClick={() => setSelectedInterval(interval)}
          >
            <Text 
              align="center"
              c={interval === selectedInterval ? 'white' : 'dimmed'}
            >
              {interval}
            </Text>
          </UnstyledButton>
        ))}
      </Group>

      {/* История транзакций */}
      <Stack mt={32} px="md">
        <Text fw={500} mb={8}>15 Февраля</Text>
        <Paper
          p="md"
          radius="md"
          style={{ background: 'rgba(255, 255, 255, 0.05)' }}
        >
          <Group justify="apart">
            <Group>
              <Box 
                style={{ 
                  width: 40, 
                  height: 40, 
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <IconArrowUp size={20} />
              </Box>
              <Stack gap={4}>
                <Text>Отправлено</Text>
                <Text size="sm" c="dimmed">UQDV...cN3I</Text>
                <Text size="sm" c="yellow">Неуспешно</Text>
              </Stack>
            </Group>
            <Stack align="flex-end" gap={4}>
              <Text>-0.01 TON</Text>
              <Text size="sm" c="dimmed">08:57</Text>
            </Stack>
          </Group>
        </Paper>
      </Stack>
    </Box>
  );
} 