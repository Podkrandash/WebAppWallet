import { Box, Text, Paper, Stack, TextInput, NumberInput, Button, Group, ActionIcon, Title } from '@mantine/core';
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
    <Stack gap="lg" p="md">
      <Group justify="space-between" align="center">
        <Title order={2}>Отправить TON</Title>
      </Group>
      
      <Paper shadow="xs" p="md" radius="md">
        <Stack gap="md">
          <TextInput
            label="Адрес получателя"
            placeholder="UQ..."
            value={address}
            onChange={(e) => setRecipientAddress(e.target.value)}
            error={error && !address ? 'Введите адрес' : null}
            size="lg"
            styles={{
              input: {
                fontSize: '16px',
                height: '50px',
                background: 'rgba(0, 0, 0, 0.03)',
                border: 'none',
                '&:focus': {
                  border: '2px solid #0A84FF'
                }
              },
              label: {
                fontSize: '16px',
                marginBottom: '8px'
              }
            }}
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
            styles={{
              input: {
                fontSize: '24px',
                height: '60px',
                textAlign: 'center',
                background: 'rgba(0, 0, 0, 0.03)',
                border: 'none',
                '&:focus': {
                  border: '2px solid #0A84FF'
                }
              },
              label: {
                fontSize: '16px',
                marginBottom: '8px'
              }
            }}
            rightSection={
              <Text c="dimmed" pr="md">TON</Text>
            }
            stepHoldDelay={500}
            stepHoldInterval={100}
            allowDecimal
            allowNegative={false}
            clampBehavior="strict"
            fixedDecimalScale
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
            size="lg"
            onClick={handleSend}
            loading={sending}
            fullWidth
            styles={{
              root: {
                height: '50px',
                background: '#0A84FF',
                '&:hover': {
                  background: '#007AFF'
                }
              }
            }}
          >
            Отправить
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
} 