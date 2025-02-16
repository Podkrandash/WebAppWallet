import { Box, Text, Button, Group, CopyButton, Stack, ActionIcon, SimpleGrid, Paper, Modal, TextInput, NumberInput } from '@mantine/core';
import { IconSend, IconDownload, IconQrcode, IconCopy, IconArrowsExchange, IconCoin, IconLock } from '@tabler/icons-react';
import { useState } from 'react';
import { sendTON } from '../lib/ton';

interface Token {
  symbol: string;
  name: string;
  balance: number;
  price: number;
  priceChange: number;
  icon: string;
  verified?: boolean;
}

interface WalletCardProps {
  balance: number;
  usdValue: string;
  address: string;
  initData: string;
}

export default function WalletCard({ 
  balance, 
  usdValue, 
  address,
  initData
}: WalletCardProps) {
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState<number | ''>(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Временные данные токенов
  const tokens: Token[] = [
    {
      symbol: 'TON',
      name: 'Toncoin',
      balance: 0.0083,
      price: 345.24,
      priceChange: 0.48,
      icon: '💎'
    },
    {
      symbol: 'FPIBANK',
      name: 'FPI Bank',
      balance: 287.28,
      price: 2.39,
      priceChange: 2.39,
      icon: '🏦'
    },
    {
      symbol: 'HMSTR',
      name: 'Hamster',
      balance: 101.06,
      price: 0.15,
      priceChange: -0.23,
      icon: '🐹'
    },
    {
      symbol: 'NOT',
      name: 'Notice',
      balance: 4.94,
      price: 0.27,
      priceChange: 2.95,
      icon: '⚠️'
    },
    {
      symbol: 'EARTH',
      name: 'Earth',
      balance: 485538.88,
      price: 0,
      priceChange: 0,
      icon: '🌍',
      verified: false
    }
  ];

  const handleSend = async () => {
    if (!amount || !recipientAddress) {
      setError('Заполните все поля');
      return;
    }

    try {
      setSending(true);
      setError(null);
      
      await sendTON(
        address,
        recipientAddress,
        Number(amount),
        initData
      );

      setSendModalOpen(false);
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert('Транзакция успешно отправлена');
      }
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Box px="md">
      {/* Основной баланс */}
      <Stack gap="xs" align="center" mb="md">
        <Text size="xl" fw={700} style={{ fontSize: '32px' }}>
          709,09 ₽
        </Text>
        <Text size="sm" c="dimmed">
          Ваш адрес: {address.slice(0, 4)}...{address.slice(-4)}
        </Text>
      </Stack>

      {/* Кнопки действий */}
      <SimpleGrid cols={3} mb="xl">
        <Stack gap={4} align="center">
          <ActionIcon 
            variant="light" 
            color="blue" 
            size="xl" 
            radius="xl"
            onClick={() => setSendModalOpen(true)}
          >
            <IconSend size={20} />
          </ActionIcon>
          <Text size="xs">Отправить</Text>
        </Stack>

        <Stack gap={4} align="center">
          <ActionIcon 
            variant="light" 
            color="blue" 
            size="xl" 
            radius="xl"
            onClick={() => {
              navigator.clipboard.writeText(address);
              window.Telegram?.WebApp?.showAlert('Адрес скопирован');
            }}
          >
            <IconDownload size={20} />
          </ActionIcon>
          <Text size="xs">Получить</Text>
        </Stack>

        <Stack gap={4} align="center">
          <ActionIcon 
            variant="light" 
            color="blue" 
            size="xl" 
            radius="xl"
          >
            <IconQrcode size={20} />
          </ActionIcon>
          <Text size="xs">Сканировать</Text>
        </Stack>

        <Stack gap={4} align="center">
          <ActionIcon 
            variant="light" 
            color="blue" 
            size="xl" 
            radius="xl"
          >
            <IconArrowsExchange size={20} />
          </ActionIcon>
          <Text size="xs">Обменять</Text>
        </Stack>

        <Stack gap={4} align="center">
          <ActionIcon 
            variant="light" 
            color="blue" 
            size="xl" 
            radius="xl"
          >
            <IconCoin size={20} />
          </ActionIcon>
          <Text size="xs">Купить TON</Text>
        </Stack>

        <Stack gap={4} align="center">
          <ActionIcon 
            variant="light" 
            color="blue" 
            size="xl" 
            radius="xl"
          >
            <IconLock size={20} />
          </ActionIcon>
          <Text size="xs">Застейкать</Text>
        </Stack>
      </SimpleGrid>

      {/* Список токенов */}
      <Stack gap="xs">
        {tokens.map((token) => (
          <Paper 
            key={token.symbol}
            p="md" 
            radius="md"
            style={{
              background: 'rgba(255, 255, 255, 0.5)',
              backdropFilter: 'blur(10px)'
            }}
          >
            <Group justify="space-between" align="flex-start">
              <Group>
                <Text size="xl">{token.icon}</Text>
                <div>
                  <Group gap={4}>
                    <Text size="sm" fw={500}>{token.symbol}</Text>
                    {token.verified === false && (
                      <Text size="xs" c="orange">Непроверенный токен</Text>
                    )}
                  </Group>
                  <Group gap={4}>
                    <Text size="xs" c="dimmed">{token.price} ₽</Text>
                    <Text 
                      size="xs" 
                      c={token.priceChange > 0 ? 'green' : token.priceChange < 0 ? 'red' : 'dimmed'}
                    >
                      {token.priceChange > 0 ? '+' : ''}{token.priceChange}%
                    </Text>
                  </Group>
                </div>
              </Group>
              <div style={{ textAlign: 'right' }}>
                <Text size="sm" fw={500}>{token.balance}</Text>
                <Text size="xs" c="dimmed">
                  {(token.balance * token.price).toFixed(2)} ₽
                </Text>
              </div>
            </Group>
          </Paper>
        ))}
      </Stack>

      {/* Модальное окно отправки */}
      <Modal
        opened={sendModalOpen}
        onClose={() => setSendModalOpen(false)}
        title="Отправить TON"
        centered
      >
        <Stack>
          <TextInput
            label="Адрес получателя"
            placeholder="UQ..."
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.currentTarget.value)}
            error={error && !recipientAddress ? 'Введите адрес' : null}
          />
          
          <NumberInput
            label="Сумма TON"
            placeholder="0.1"
            value={amount}
            onChange={(value) => setAmount(typeof value === 'string' ? '' : value)}
            min={0.01}
            max={balance - 0.05}
            decimalScale={2}
            error={error && !amount ? 'Введите сумму' : null}
          />

          {error && (
            <Text c="red" size="sm">
              {error}
            </Text>
          )}

          <Text size="sm" c="dimmed">
            Комиссия: 0.05 TON
          </Text>

          <Button
            onClick={handleSend}
            loading={sending}
            disabled={!amount || !recipientAddress || sending}
          >
            Отправить
          </Button>
        </Stack>
      </Modal>
    </Box>
  );
} 