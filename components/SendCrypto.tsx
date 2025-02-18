import { Box, Text, Paper, Stack, TextInput, NumberInput, Button, Group, ActionIcon } from '@mantine/core';
import { IconQrcode, IconScan, IconArrowLeft } from '@tabler/icons-react';
import { useState } from 'react';
import { sendTON } from '../lib/ton';

interface SendCryptoProps {
  balance: number;
  address: string;
  initData: string;
  onBack: () => void;
}

export default function SendCrypto({
  balance,
  address,
  initData,
  onBack
}: SendCryptoProps) {
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState<number | ''>(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'select' | 'amount' | 'confirm'>('select');

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

      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert('Транзакция успешно отправлена');
      }
      onBack();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setSending(false);
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
      {/* Хедер */}
      <Group justify="space-between" align="center">
        <ActionIcon 
          variant="subtle" 
          color="gray" 
          onClick={onBack}
          size="lg"
        >
          <IconArrowLeft size={24} />
        </ActionIcon>
        <Text fw={700} size="lg">Отправить</Text>
        <Box w={40} />
      </Group>

      {step === 'select' && (
        <Stack gap="md">
          <Paper p="xl" radius="lg" style={{ background: 'white' }}>
            <Stack align="center" gap="md">
              <img 
                src="https://ton.org/download/ton_symbol.png" 
                alt="TON"
                style={{ 
                  width: 64,
                  height: 64,
                  borderRadius: '50%'
                }}
              />
              <Text fw={700} size="xl">TON</Text>
              <Text size="sm" c="dimmed">Баланс: {balance.toFixed(2)} TON</Text>
              <Button 
                fullWidth 
                size="lg" 
                radius="xl"
                onClick={() => setStep('amount')}
              >
                Выбрать
              </Button>
            </Stack>
          </Paper>

          {/* Другие криптовалюты можно добавить здесь */}
        </Stack>
      )}

      {step === 'amount' && (
        <Stack gap="md">
          <Paper p="xl" radius="lg" style={{ background: 'white' }}>
            <Stack gap="lg">
              <Group justify="space-between">
                <Text fw={500}>Доступно</Text>
                <Text fw={700}>{(balance - 0.05).toFixed(2)} TON</Text>
              </Group>

              <TextInput
                label="Адрес получателя"
                placeholder="UQ..."
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.currentTarget.value)}
                error={error && !recipientAddress ? 'Введите адрес' : null}
                size="lg"
                rightSection={
                  <ActionIcon variant="subtle" onClick={() => {/* TODO: Добавить сканирование QR */}}>
                    <IconScan size={20} />
                  </ActionIcon>
                }
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
                size="lg"
              />

              {error && (
                <Text c="red" size="sm">
                  {error}
                </Text>
              )}

              <Text size="sm" c="dimmed">
                Комиссия сети: 0.05 TON
              </Text>

              <Button
                onClick={handleSend}
                loading={sending}
                disabled={!amount || !recipientAddress || sending}
                size="lg"
                radius="xl"
              >
                Отправить
              </Button>
            </Stack>
          </Paper>
        </Stack>
      )}
    </Box>
  );
} 