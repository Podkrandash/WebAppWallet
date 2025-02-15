import { Card, Title, Text, Button, Group, CopyButton } from '@mantine/core';
import { Line } from 'react-chartjs-2';

interface WalletCardProps {
  balance: number;
  address: string;
  onDeposit: () => void;
  onWithdraw: () => void;
}

export default function WalletCard({ balance, address, onDeposit, onWithdraw }: WalletCardProps) {
  return (
    <Card shadow="sm" p="lg" radius="md">
      <Title order={2} mb="md">Ваш TON кошелек</Title>
      
      <Group justify="space-between" mb="md">
        <Text fz="xl" fw={700}>
          {balance.toFixed(2)} TON
        </Text>
        <CopyButton value={address}>
          {({ copied, copy }) => (
            <Button 
              variant="light" 
              color={copied ? 'teal' : 'blue'} 
              onClick={copy}
            >
              {copied ? 'Скопировано!' : 'Копировать адрес'}
            </Button>
          )}
        </CopyButton>
      </Group>

      <Text size="sm" c="dimmed" mb="md">
        Адрес: {address.slice(0, 6)}...{address.slice(-4)}
      </Text>

      <Group grow>
        <Button color="blue" onClick={onDeposit}>
          Пополнить
        </Button>
        <Button color="green" onClick={onWithdraw}>
          Вывести
        </Button>
      </Group>
    </Card>
  );
} 