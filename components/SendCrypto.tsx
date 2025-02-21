import { Box, Text, Paper, Stack, TextInput, NumberInput, Button, Group, SegmentedControl } from '@mantine/core';
import { IconSend } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { sendTON, sendUSDT, sendEarth } from '../lib/ton';
import { Address } from '@ton/ton';

interface SendCryptoProps {
  balance: number;
  usdtBalance: number;
  earthBalance: number;
  address: string;
  initData: string;
  onBack: () => void;
}

type CryptoType = 'TON' | 'USDT' | 'EARTH';

export default function SendCrypto({
  balance,
  usdtBalance,
  earthBalance,
  address,
  initData,
  onBack
}: SendCryptoProps) {
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoType>('TON');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
    if (!recipientAddress || !amount) {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert('Заполните все поля');
      }
      return;
    }

    setSending(true);
    setError(null);
    
    console.log('=== Начало отправки транзакции ===');
    console.log('Параметры:', {
      type: selectedCrypto,
      from: address,
      to: recipientAddress,
      amount: Number(amount)
    });
    
    try {
      if (!initData) {
        setError('Ошибка инициализации. Попробуйте перезапустить приложение');
        return;
      }

      let result;
      switch (selectedCrypto) {
        case 'TON':
          result = await sendTON(address, recipientAddress, Number(amount), initData);
          break;
        case 'USDT':
          result = await sendUSDT(address, recipientAddress, Number(amount), initData);
          break;
        case 'EARTH':
          result = await sendEarth(address, recipientAddress, Number(amount), initData);
          break;
      }

      console.log('=== Транзакция успешно отправлена ===');
      
      if (result.success) {
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.showAlert('Транзакция успешно отправлена');
        }
        onBack();
      } else {
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.showAlert('Ошибка: ' + (result.error || 'Произошла ошибка при отправке'));
        }
      }
    } catch (error: any) {
      console.error('=== Ошибка отправки транзакции ===', {
        message: error.message,
        stack: error.stack
      });
      
      setError(error.message);
      
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert('Ошибка: ' + error.message);
      }
    } finally {
      setSending(false);
    }
  };

  const getCurrentBalance = () => {
    switch (selectedCrypto) {
      case 'TON':
        return balance;
      case 'USDT':
        return usdtBalance;
      case 'EARTH':
        return earthBalance;
      default:
        return 0;
    }
  };

  const networkFee = 0.05;
  const currentBalance = getCurrentBalance();
  const maxAvailableAmount = Math.max(0, currentBalance - (selectedCrypto === 'TON' ? networkFee : 0));

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
              onChange={(value: string) => {
                setSelectedCrypto(value as CryptoType);
                setAmount(0);
                setError(null);
              }}
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
                },
                {
                  label: (
                    <Group>
                      <img 
                        src="/earth-token-logo.png" 
                        alt="EARTH"
                        style={{ width: 20, height: 20, borderRadius: '50%' }}
                      />
                      <Text>EARTH</Text>
                    </Group>
                  ),
                  value: 'EARTH'
                }
              ]}
              fullWidth
              size="lg"
            />

            <Group justify="center">
              <img 
                src={
                  selectedCrypto === 'TON' 
                    ? "https://ton.org/download/ton_symbol.png"
                    : selectedCrypto === 'USDT'
                    ? "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png"
                    : "/earth-token-logo.png"
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
                  Доступно: {maxAvailableAmount.toFixed(selectedCrypto === 'TON' ? 2 : 6)} {selectedCrypto}
                </Text>
              </Stack>
            </Group>

            <TextInput
              label="Адрес получателя"
              placeholder="Введите адрес TON"
              description="Например: EQBvW8Z5huBkMJYdnfAEM5JqTNkuWX3diqYENkWsIL0XggGG"
              value={recipientAddress}
              onChange={(e) => {
                const value = e.target.value;
                setRecipientAddress(value);
                
                if (value) {
                  try {
                    console.log('Пробуем парсить адрес:', value);
                    const parsedAddress = Address.parse(value.trim());
                    console.log('Адрес успешно распарсен:', parsedAddress.toString());
                    setError(null);
                  } catch (error) {
                    console.error('Ошибка парсинга адреса:', error);
                    setError('Неверный формат адреса TON');
                  }
                } else {
                  setError(null);
                }
              }}
              error={error}
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
              placeholder="0.00"
              value={amount}
              onChange={(value) => setAmount(typeof value === 'string' ? parseFloat(value) || 0 : value)}
              min={0}
              max={maxAvailableAmount}
              decimalScale={selectedCrypto === 'TON' ? 2 : 6}
              hideControls
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
                Комиссия сети: {networkFee} TON
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