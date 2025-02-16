import { Card, Title, Text, Button, Group, CopyButton, Stack, ActionIcon, Box, Center, Paper, Modal, TextInput, NumberInput } from '@mantine/core';
import { IconSend, IconDownload, IconQrcode, IconCopy } from '@tabler/icons-react';
import { useState } from 'react';
import { sendTON } from '../lib/ton';

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

  const handleAmountChange = (value: string | number) => {
    setAmount(typeof value === 'string' ? '' : value);
  };

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

  const handleReceive = () => {
    navigator.clipboard.writeText(address)
      .then(() => window.Telegram?.WebApp?.showAlert('Адрес скопирован в буфер обмена'))
      .catch(() => window.Telegram?.WebApp?.showAlert('Не удалось скопировать адрес'));
  };

  return (
    <>
      <Box px="md">
        <Paper 
          radius="xl" 
          p="xl" 
          style={{ 
            background: 'linear-gradient(135deg, #0A84FF 0%, #0066CC 100%)',
            color: 'white',
            marginBottom: '1rem'
          }}
        >
          <Stack align="center" gap="xs">
            <Text size="sm" fw={500} c="white" opacity={0.8}>Баланс</Text>
            <Title order={1} style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
              {balance.toFixed(2)} TON
            </Title>
            <Text size="sm" c="white" opacity={0.8}>≈ ${usdValue}</Text>
          </Stack>
        </Paper>

        <Paper 
          radius="lg" 
          p="md" 
          withBorder 
          style={{ 
            background: 'rgba(255, 255, 255, 0.95)',
            marginBottom: '1.5rem'
          }}
        >
          <Stack gap="md" align="center">
            <Text size="sm" c="dimmed" fw={500}>Адрес кошелька</Text>
            <Group gap="xs" align="center">
              <Text size="sm" style={{ fontFamily: 'monospace' }}>
                {address.slice(0, 6)}...{address.slice(-4)}
              </Text>
              <CopyButton value={address}>
                {({ copied, copy }) => (
                  <ActionIcon 
                    variant="subtle" 
                    color={copied ? 'teal' : 'gray'} 
                    onClick={copy}
                    size="sm"
                  >
                    <IconCopy size={16} />
                  </ActionIcon>
                )}
              </CopyButton>
            </Group>
          </Stack>
        </Paper>

        <Group grow gap="md">
          <Button
            variant="light"
            color="blue"
            radius="xl"
            size="lg"
            leftSection={<IconSend size={20} />}
            onClick={() => setSendModalOpen(true)}
            style={{ flex: 1 }}
          >
            Отправить
          </Button>
          <Button
            variant="light"
            color="teal"
            radius="xl"
            size="lg"
            leftSection={<IconDownload size={20} />}
            onClick={handleReceive}
            style={{ flex: 1 }}
          >
            Получить
          </Button>
        </Group>
      </Box>

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
            onChange={handleAmountChange}
            min={0.01}
            max={balance - 0.05} // Учитываем комиссию
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
    </>
  );
} 