import { Box, Text, Paper, Stack, TextInput, NumberInput, Button, Group, SegmentedControl } from '@mantine/core';
import { IconSend } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { sendTON, sendUSDT } from '../lib/ton';

interface SendCryptoProps {
  balance: number;
  usdtBalance: number;
  address: string;
  initData: string;
  onBack: () => void;
}

type CryptoType = 'TON' | 'USDT';

export default function SendCrypto({
  balance,
  usdtBalance,
  address,
  initData,
  onBack
}: SendCryptoProps) {
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoType>('TON');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState<number | ''>(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Показываем кнопку назад в Telegram WebApp
    if (window.Telegram?.WebApp?.BackButton) {
      window.Telegram.WebApp.BackButton.show();
      window.Telegram.WebApp.BackButton.onClick(onBack);
    }

    return () => {
      if (window.Telegram?.WebApp?.BackButton) {
        window.Telegram.WebApp.BackButton.hide();
        window.Telegram.WebApp.BackButton.onClick(() => {});
      }
    };
  }, [onBack]);

  const handleSend = async () => {
    if (!amount || !recipientAddress) {
      setError('Заполните все поля');
      return;
    }

    try {
      setSending(true);
      setError(null);
      
      if (selectedCrypto === 'TON') {
        await sendTON(
          address,
          recipientAddress,
          Number(amount),
          initData
        );
      } else {
        await sendUSDT(
          address,
          recipientAddress,
          Number(amount),
          initData
        );
      }

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

  const currentBalance = selectedCrypto === 'TON' ? balance : usdtBalance;
  const commissionInTon = 0.05;

  return (
    <Box style={{ 
      height: '100vh',
      background: '#F2F2F7',
      padding: '16px'
    }}>
      <Stack gap="md">
        <Paper p="xl" radius="lg" style={{ background: 'white' }}>
          <Stack gap="xl">
            <SegmentedControl
              value={selectedCrypto}
              onChange={(value) => setSelectedCrypto(value as CryptoType)}
              data={[
                {
                  label: (
                    <Group>
                      <img 
                        src="https://ton.org/download/ton_symbol.png" 
                        alt="TON"
                        style={{ width: 20, height: 20, borderRadius: '50%' }}
                      />
                      <Text>TON</Text>
                    </Group>
                  ),
                  value: 'TON'
                },
                {
                  label: (
                    <Group>
                      <img 
                        src="https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png" 
                        alt="USDT"
                        style={{ width: 20, height: 20, borderRadius: '50%' }}
                      />
                      <Text>USDT</Text>
                    </Group>
                  ),
                  value: 'USDT'
                }
              ]}
              fullWidth
              size="lg"
            />

            <Group justify="center">
              <img 
                src={selectedCrypto === 'TON' 
                  ? "https://ton.org/download/ton_symbol.png"
                  : "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png"
                }
                alt={selectedCrypto}
                style={{ 
                  width: 64,
                  height: 64,
                  borderRadius: '50%'
                }}
              />
              <Stack gap={4} align="center">
                <Text size="xl" fw={700}>{selectedCrypto}</Text>
                <Text size="sm" c="dimmed">
                  Доступно: {(currentBalance - (selectedCrypto === 'TON' ? commissionInTon : 0)).toFixed(selectedCrypto === 'TON' ? 2 : 6)} {selectedCrypto}
                </Text>
              </Stack>
            </Group>

            <TextInput
              label="Адрес получателя"
              placeholder="UQ..."
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              error={error && !recipientAddress ? 'Введите адрес' : null}
              size="lg"
              styles={{
                input: {
                  fontSize: '16px',
                  height: '56px',
                  background: 'rgba(0, 0, 0, 0.03)',
                  border: 'none',
                  borderRadius: '12px',
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
              label="Сумма"
              placeholder={selectedCrypto === 'TON' ? "0.1" : "1.000000"}
              value={amount}
              onChange={(value) => setAmount(typeof value === 'string' ? '' : value)}
              min={selectedCrypto === 'TON' ? 0.01 : 0.000001}
              max={currentBalance - (selectedCrypto === 'TON' ? commissionInTon : 0)}
              decimalScale={selectedCrypto === 'TON' ? 2 : 6}
              error={error && !amount ? 'Введите сумму' : null}
              size="xl"
              styles={{
                input: {
                  fontSize: '32px',
                  height: '80px',
                  textAlign: 'center',
                  background: 'rgba(0, 0, 0, 0.03)',
                  border: 'none',
                  borderRadius: '16px',
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
                <Text c="dimmed" pr="md" fw={500}>{selectedCrypto}</Text>
              }
            />

            {error && (
              <Text c="red" size="sm" ta="center">
                {error}
              </Text>
            )}

            <Stack gap="md">
              <Text size="sm" c="dimmed" ta="center">
                Комиссия сети: {commissionInTon} TON
              </Text>

              <Button
                size="xl"
                onClick={handleSend}
                loading={sending}
                leftIcon={<IconSend size={20} />}
                styles={{
                  root: {
                    height: '56px',
                    background: '#0A84FF',
                    borderRadius: '12px',
                    '&:hover': {
                      background: '#007AFF'
                    }
                  }
                }}
              >
                Отправить
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
} 