import { Box, Text, Paper, Stack, Button } from '@mantine/core';
import { IconQrcode } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface QrScannerProps {
  onScan: (address: string, amount?: number) => void;
  onBack: () => void;
}

export default function QrScanner({ onScan, onBack }: QrScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

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

  useEffect(() => {
    if (!scanning) return;

    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      { 
        fps: 10,
        qrbox: 250,
        aspectRatio: 1.0
      },
      false
    );

    scanner.render(
      (decodedText: string) => {
        // Успешное сканирование
        console.log('QR код успешно отсканирован:', decodedText);
        
        try {
          // Пробуем распарсить данные из QR кода
          // Ожидаемый формат: ton://transfer/<address>?amount=<amount>
          const url = new URL(decodedText);
          
          if (url.protocol === 'ton:') {
            const parts = url.pathname.split('/');
            const address = parts[parts.length - 1];
            const amount = url.searchParams.get('amount');
            
            onScan(address, amount ? Number(amount) : undefined);
          } else {
            // Если это просто адрес
            onScan(decodedText);
          }
          
          scanner.clear();
        } catch (error) {
          console.error('Ошибка парсинга QR кода:', error);
          setError('Неверный формат QR кода');
        }
      },
      (errorMessage: string) => {
        // Ошибка сканирования
        console.error('Ошибка сканирования QR кода:', errorMessage);
      }
    );

    return () => {
      scanner.clear();
    };
  }, [scanning, onScan]);

  return (
    <Box style={{ 
      height: '100vh',
      background: '#F2F2F7',
      padding: '16px'
    }}>
      <Stack gap="md">
        <Paper p="xl" radius="lg" style={{ background: 'white' }}>
          <Stack gap="xl" align="center">
            <Text size="xl" fw={700}>Сканирование QR-кода</Text>
            
            <div id="qr-reader" style={{ width: '100%', maxWidth: '500px' }} />

            {error && (
              <Text c="red" size="sm">
                {error}
              </Text>
            )}

            <Button
              size="xl"
              onClick={() => setScanning(true)}
              leftIcon={<IconQrcode size={20} />}
              disabled={scanning}
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
              {scanning ? 'Сканирование...' : 'Начать сканирование'}
            </Button>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
} 