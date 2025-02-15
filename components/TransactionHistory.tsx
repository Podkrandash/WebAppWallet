import { Stack, Text, Card, Group } from '@mantine/core';
import { IconArrowUpRight, IconArrowDownRight } from '@tabler/icons-react';

interface Transaction {
  type: 'deposit' | 'withdrawal';
  amount: number;
  fromCurrency: string;
  status: string;
  timestamp: string;
}

interface TransactionHistoryProps {
  transactions: Transaction[];
}

export default function TransactionHistory({ transactions }: TransactionHistoryProps) {
  if (transactions.length === 0) {
    return (
      <Text ta="center" c="dimmed" mt="xl">
        История транзакций пуста
      </Text>
    );
  }

  return (
    <Stack gap="md">
      {transactions.map((tx, index) => (
        <Card key={index} shadow="sm" p="md" radius="md" withBorder>
          <Group justify="space-between">
            <Group>
              {tx.type === 'deposit' ? (
                <IconArrowDownRight size={24} color="#40c057" />
              ) : (
                <IconArrowUpRight size={24} color="#fa5252" />
              )}
              <div>
                <Text size="sm" fw={500}>
                  {tx.type === 'deposit' ? 'Получено' : 'Отправлено'}
                </Text>
                <Text size="xs" c="dimmed">
                  {new Date(tx.timestamp).toLocaleString()}
                </Text>
              </div>
            </Group>
            <div style={{ textAlign: 'right' }}>
              <Text fw={500}>
                {tx.type === 'deposit' ? '+' : '-'}{tx.amount} {tx.fromCurrency}
              </Text>
              <Text size="xs" c={tx.status === 'completed' ? 'teal' : 'orange'}>
                {tx.status === 'completed' ? 'Завершено' : 'В обработке'}
              </Text>
            </div>
          </Group>
        </Card>
      ))}
    </Stack>
  );
} 