import { Box, Text, Button, Group, CopyButton, Stack, ActionIcon, SimpleGrid, Paper, Modal, TextInput, NumberInput } from '@mantine/core';
import { IconSend, IconDownload, IconQrcode, IconCopy, IconArrowsExchange, IconCoin, IconLock } from '@tabler/icons-react';
import { useState } from 'react';
import { sendTON } from '../lib/ton';
import { TonDetails } from './TonDetails';
import SendCrypto from './SendCrypto';
import UsdtDetails from './UsdtDetails';
import Exchange from './Exchange';
import QrScanner from './QrScanner';

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
  tonPrice?: number;
  usdtBalance: number;
}

export default function WalletCard({ 
  balance, 
  usdValue, 
  address,
  initData,
  tonPrice = 0,
  usdtBalance = 0
}: WalletCardProps) {
  const [showTonDetails, setShowTonDetails] = useState(false);
  const [showUsdtDetails, setShowUsdtDetails] = useState(false);
  const [showSendCrypto, setShowSendCrypto] = useState(false);
  const [showExchange, setShowExchange] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);

  // Расчет общего баланса в рублях
  const totalBalanceRub = Number(usdValue.replace(/[^\d.-]/g, '')) + (usdtBalance * 100);

  const handleQrScan = (address: string, amount?: number) => {
    setShowQrScanner(false);
    setShowSendCrypto(true);
    // TODO: Передать отсканированные данные в компонент отправки
  };

  if (showTonDetails) {
    return (
      <TonDetails
        balance={balance}
        usdValue={Number(usdValue.replace(/[^\d.-]/g, ''))}
        address={address}
        tonPrice={tonPrice}
        priceChange={0}
        onBack={() => setShowTonDetails(false)}
      />
    );
  }

  if (showUsdtDetails) {
    return (
      <UsdtDetails
        usdtBalance={usdtBalance}
        address={address}
        onBack={() => setShowUsdtDetails(false)}
      />
    );
  }

  if (showSendCrypto) {
    return (
      <SendCrypto
        balance={balance}
        usdtBalance={usdtBalance}
        address={address}
        initData={initData}
        onBack={() => setShowSendCrypto(false)}
      />
    );
  }

  if (showExchange) {
    return (
      <Exchange
        balance={balance}
        usdtBalance={usdtBalance}
        address={address}
        initData={initData}
        onBack={() => setShowExchange(false)}
      />
    );
  }

  if (showQrScanner) {
    return (
      <QrScanner
        onScan={handleQrScan}
        onBack={() => setShowQrScanner(false)}
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
            {totalBalanceRub.toFixed(2)} ₽
          </Text>
          <Group gap={8}>
            <Text size="lg" c="dimmed">
              {balance.toFixed(2)} TON
            </Text>
            <Text size="lg" c="dimmed">•</Text>
            <Text size="lg" c="dimmed">
              {usdtBalance.toFixed(2)} USDT
            </Text>
          </Group>
          <Text size="sm" c="dimmed">
            {address.slice(0, 4)}...{address.slice(-4)}
          </Text>
        </Stack>

        {/* Кнопки действий */}
        <SimpleGrid 
          cols={{ base: 4, sm: 4 }}
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
            >
              <IconSend size={24} />
            </ActionIcon>
            <Text size="sm">Отправить</Text>
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
              <IconDownload size={24} />
            </ActionIcon>
            <Text size="sm">Получить</Text>
          </Stack>

          <Stack gap={4} align="center">
            <ActionIcon 
              variant="light" 
              color="blue" 
              size="xl"
              radius="xl"
              onClick={() => setShowExchange(true)}
            >
              <IconArrowsExchange size={24} />
            </ActionIcon>
            <Text size="sm">Обменять</Text>
          </Stack>

          <Stack gap={4} align="center">
            <ActionIcon 
              variant="light" 
              color="blue" 
              size="xl"
              radius="xl"
              onClick={() => setShowQrScanner(true)}
            >
              <IconQrcode size={24} />
            </ActionIcon>
            <Text size="sm">Сканировать</Text>
          </Stack>
        </SimpleGrid>

        {/* Список токенов */}
        <Stack gap="md">
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
                    <Text c="dimmed"> {tonPrice.toFixed(2)} ₽</Text>
                    <Text c="green">+0.48%</Text>
                  </Group>
                </div>
              </Group>
              <div style={{ textAlign: 'right' }}>
                <Text fw={500}>{balance.toFixed(2)} TON</Text>
                <Text c="dimmed">
                  {usdValue} ₽
                </Text>
              </div>
            </Group>
          </Paper>

          <Paper 
            p="md"
            radius="md"
            style={{
              background: 'rgba(255, 255, 255, 0.5)',
              backdropFilter: 'blur(10px)',
              cursor: 'pointer'
            }}
            onClick={() => setShowUsdtDetails(true)}
          >
            <Group justify="space-between" align="flex-start">
              <Group>
                <img 
                  src="https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png" 
                  alt="USDT"
                  style={{ 
                    width: 32,
                    height: 32,
                    borderRadius: '50%'
                  }}
                />
                <div>
                  <Group gap={4}>
                    <Text fw={500}>USDT</Text>
                  </Group>
                  <Group gap={4}>
                    <Text c="dimmed">91.00 ₽</Text>
                  </Group>
                </div>
              </Group>
              <div style={{ textAlign: 'right' }}>
                <Text fw={500}>{usdtBalance.toFixed(2)} USDT</Text>
                <Text c="dimmed">
                  {(usdtBalance * 100).toFixed(2)} ₽
                </Text>
              </div>
            </Group>
          </Paper>
        </Stack>
      </Stack>
    </Box>
  );
} 