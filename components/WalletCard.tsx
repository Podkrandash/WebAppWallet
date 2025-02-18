import { Box, Text, Button, Group, CopyButton, Stack, ActionIcon, SimpleGrid, Paper, Modal, TextInput, NumberInput } from '@mantine/core';
import { IconSend, IconDownload, IconQrcode, IconCopy, IconArrowsExchange, IconCoin, IconLock } from '@tabler/icons-react';
import { useState } from 'react';
import { sendTON } from '../lib/ton';
import TonDetails from './TonDetails';
import SendCrypto from './SendCrypto';

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
  const [showTonDetails, setShowTonDetails] = useState(false);
  const [showSendCrypto, setShowSendCrypto] = useState(false);

  if (showTonDetails) {
    return (
      <TonDetails
        balance={balance}
        usdValue={usdValue}
        address={address}
        priceChange={-39.37}
        onBack={() => setShowTonDetails(false)}
      />
    );
  }

  if (showSendCrypto) {
    return (
      <SendCrypto
        balance={balance}
        address={address}
        initData={initData}
        onBack={() => setShowSendCrypto(false)}
      />
    );
  }

  return (
    <Box style={{ height: '100%', position: 'relative' }}>
      <Stack gap="xl" pb={80} px="md">
        {/* Основной баланс */}
        <Stack gap="md" align="center" pt={24}>
          <Text 
            fw={700} 
            style={{ 
              fontSize: 'clamp(28px, 8vw, 40px)',
              lineHeight: 1.1
            }}
          >
            {usdValue} ₽
          </Text>
          <Text size="sm" c="dimmed">
            {address.slice(0, 4)}...{address.slice(-4)}
          </Text>
        </Stack>

        {/* Кнопки действий */}
        <SimpleGrid 
          cols={{ base: 3, sm: 6 }}
          spacing="md"
          pt={8}
        >
          <Stack gap={4} align="center">
            <ActionIcon 
              variant="light" 
              color="blue" 
              size="xl"
              radius="xl"
              onClick={() => setShowSendCrypto(true)}
              style={{
                width: 'clamp(40px, 10vw, 48px)',
                height: 'clamp(40px, 10vw, 48px)'
              }}
            >
              <IconSend style={{ width: 'clamp(18px, 5vw, 20px)', height: 'clamp(18px, 5vw, 20px)' }} />
            </ActionIcon>
            <Text style={{ fontSize: 'clamp(11px, 3vw, 14px)' }}>Отправить</Text>
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
              style={{
                width: 'clamp(40px, 10vw, 48px)',
                height: 'clamp(40px, 10vw, 48px)'
              }}
            >
              <IconDownload style={{ width: 'clamp(18px, 5vw, 20px)', height: 'clamp(18px, 5vw, 20px)' }} />
            </ActionIcon>
            <Text style={{ fontSize: 'clamp(11px, 3vw, 14px)' }}>Получить</Text>
          </Stack>

          <Stack gap={4} align="center">
            <ActionIcon 
              variant="light" 
              color="blue" 
              size="xl"
              radius="xl"
              style={{
                width: 'clamp(40px, 10vw, 48px)',
                height: 'clamp(40px, 10vw, 48px)'
              }}
            >
              <IconQrcode style={{ width: 'clamp(18px, 5vw, 20px)', height: 'clamp(18px, 5vw, 20px)' }} />
            </ActionIcon>
            <Text style={{ fontSize: 'clamp(11px, 3vw, 14px)' }}>Сканировать</Text>
          </Stack>

          <Stack gap={4} align="center">
            <ActionIcon 
              variant="light" 
              color="blue" 
              size="xl"
              radius="xl"
              style={{
                width: 'clamp(40px, 10vw, 48px)',
                height: 'clamp(40px, 10vw, 48px)'
              }}
            >
              <IconArrowsExchange style={{ width: 'clamp(18px, 5vw, 20px)', height: 'clamp(18px, 5vw, 20px)' }} />
            </ActionIcon>
            <Text style={{ fontSize: 'clamp(11px, 3vw, 14px)' }}>Обменять</Text>
          </Stack>

          <Stack gap={4} align="center">
            <ActionIcon 
              variant="light" 
              color="blue" 
              size="xl"
              radius="xl"
              style={{
                width: 'clamp(40px, 10vw, 48px)',
                height: 'clamp(40px, 10vw, 48px)'
              }}
            >
              <IconCoin style={{ width: 'clamp(18px, 5vw, 20px)', height: 'clamp(18px, 5vw, 20px)' }} />
            </ActionIcon>
            <Text style={{ fontSize: 'clamp(11px, 3vw, 14px)' }}>Купить TON</Text>
          </Stack>

          <Stack gap={4} align="center">
            <ActionIcon 
              variant="light" 
              color="blue" 
              size="xl"
              radius="xl"
              style={{
                width: 'clamp(40px, 10vw, 48px)',
                height: 'clamp(40px, 10vw, 48px)'
              }}
            >
              <IconLock style={{ width: 'clamp(18px, 5vw, 20px)', height: 'clamp(18px, 5vw, 20px)' }} />
            </ActionIcon>
            <Text style={{ fontSize: 'clamp(11px, 3vw, 14px)' }}>Застейкать</Text>
          </Stack>
        </SimpleGrid>

        {/* Список токенов */}
        <Paper 
          p="md"
          radius="md"
          style={{
            background: 'rgba(255, 255, 255, 0.5)',
            backdropFilter: 'blur(10px)',
            cursor: 'pointer'
          }}
          onClick={() => setShowTonDetails(true)}
        >
          <Group justify="space-between" align="flex-start">
            <Group>
              <img 
                src="https://ton.org/download/ton_symbol.png" 
                alt="TON"
                style={{ 
                  width: 32,
                  height: 32,
                  borderRadius: '50%'
                }}
              />
              <div>
                <Group gap={4}>
                  <Text fw={500}>TON</Text>
                </Group>
                <Group gap={4}>
                  <Text c="dimmed">{usdValue} ₽</Text>
                  <Text c="green">+0.48%</Text>
                </Group>
              </div>
            </Group>
            <div style={{ textAlign: 'right' }}>
              <Text fw={500}>{balance.toFixed(2)}</Text>
              <Text c="dimmed">
                {usdValue} ₽
              </Text>
            </div>
          </Group>
        </Paper>
      </Stack>
    </Box>
  );
} 