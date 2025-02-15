import { Card, Title, Text, Button, Group, CopyButton, Stack, ActionIcon } from '@mantine/core';
import { IconSend, IconDownload, IconQrcode } from '@tabler/icons-react';

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
    <Card shadow="sm" p="lg" radius="md" withBorder>
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Text size="sm" c="dimmed">Баланс</Text>
            <Title order={2}>{balance.toFixed(2)} TON</Title>
            <Text size="sm" c="dimmed">≈ ${usdValue}</Text>
          </Stack>
          <Group>
            <ActionIcon variant="light" color="blue" size="lg" onClick={onSend}>
              <IconSend size={20} />
            </ActionIcon>
            <ActionIcon variant="light" color="green" size="lg" onClick={onReceive}>
              <IconDownload size={20} />
            </ActionIcon>
            <ActionIcon variant="light" color="gray" size="lg" onClick={onQRCode}>
              <IconQrcode size={20} />
            </ActionIcon>
          </Group>
        </Group>

        <Group justify="space-between" align="center">
          <Text size="sm" style={{ wordBreak: 'break-all' }}>
            {address.slice(0, 6)}...{address.slice(-4)}
          </Text>
          <CopyButton value={address}>
            {({ copied, copy }) => (
              <Button 
                variant="light" 
                color={copied ? 'teal' : 'blue'} 
                size="xs"
                onClick={copy}
              >
                {copied ? 'Скопировано!' : 'Копировать'}
              </Button>
            )}
          </CopyButton>
        </Group>
      </Stack>
    </Card>
  );
} 