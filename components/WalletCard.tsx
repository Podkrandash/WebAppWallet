import { Box, Text, Button, Group, CopyButton, Stack, ActionIcon, SimpleGrid, Paper, Modal, TextInput, NumberInput } from '@mantine/core';
import { IconSend, IconDownload, IconQrcode, IconCopy, IconArrowsExchange, IconCoin, IconLock } from '@tabler/icons-react';
import { useState } from 'react';
import { sendTON } from '../lib/ton';
import TonDetails from './TonDetails';

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
  const [showTonDetails, setShowTonDetails] = useState(false);
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState<number | ''>(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
              onClick={() => setSendModalOpen(true)}
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

      {/* Модальное окно отправки */}
      <Modal
        opened={sendModalOpen}
        onClose={() => setSendModalOpen(false)}
        title="Отправить TON"
        centered
        size="md"
        padding="md"
      >
        <Stack>
          <TextInput
            label="Адрес получателя"
            placeholder="UQ..."
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.currentTarget.value)}
            error={error && !recipientAddress ? 'Введите адрес' : null}
            size="md"
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
            size="md"
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
            size="md"
          >
            Отправить
          </Button>
        </Stack>
      </Modal>
    </Box>
  );
} 