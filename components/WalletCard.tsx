import { Card, Title, Text, Button, Group, CopyButton, Stack, ActionIcon, Box, Center, Paper } from '@mantine/core';
import { IconSend, IconDownload, IconQrcode, IconCopy } from '@tabler/icons-react';

interface WalletCardProps {
  balance: number;
  usdValue: string;
  address: string;
  onSend: () => void;
  onReceive: () => void;
  onQRCode: () => void;
}

export default function WalletCard({ 
  balance, 
  usdValue, 
  address, 
  onSend, 
  onReceive, 
  onQRCode 
}: WalletCardProps) {
  return (
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
          onClick={onSend}
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
          onClick={onReceive}
          style={{ flex: 1 }}
        >
          Получить
        </Button>
      </Group>
      <Button
        variant="light"
        color="gray"
        radius="xl"
        size="lg"
        leftSection={<IconQrcode size={20} />}
        onClick={onQRCode}
        fullWidth
        mt="md"
      >
        QR-код
      </Button>
    </Box>
  );
} 