import { Stack, Text, Paper, Group, Box } from '@mantine/core';
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
      <Paper 
        radius="lg" 
        p="xl" 
        style={{ 
          background: 'rgba(255, 255, 255, 0.95)',
          textAlign: 'center'
        }}
      >
        <Text c="dimmed">История транзакций пуста</Text>
      </Paper>
    );
  }

  return (
    <Stack gap="md">
      {transactions.map((tx, index) => (
        <Paper
          key={index}
          radius="lg"
          p="md"
          style={{ 
            background: 'rgba(255, 255, 255, 0.95)',
            overflow: 'hidden'
          }}
        >
          <Group justify="space-between" align="flex-start">
            <Group gap="md">
              <Box
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: tx.type === 'deposit' 
                    ? 'rgba(52, 199, 89, 0.1)' 
                    : 'rgba(255, 69, 58, 0.1)'
                }}
              >
                {tx.type === 'deposit' ? (
                  <IconArrowDownRight 
                    size={24} 
                    color="#34C759"
                    style={{ strokeWidth: 2.5 }}
                  />
                ) : (
                  <IconArrowUpRight 
                    size={24} 
                    color="#FF3B30"
                    style={{ strokeWidth: 2.5 }}
                  />
                )}
              </Box>
              <div>
                <Text size="sm" fw={600} style={{ marginBottom: 4 }}>
                  {tx.type === 'deposit' ? 'Получено' : 'Отправлено'}
                </Text>
                <Text size="xs" c="dimmed">
                  {new Date(tx.timestamp).toLocaleString()}
                </Text>
              </div>
            </Group>
            <div style={{ textAlign: 'right' }}>
              <Text fw={600} style={{ 
                color: tx.type === 'deposit' ? '#34C759' : '#FF3B30',
                marginBottom: 4
              }}>
                {tx.type === 'deposit' ? '+' : '-'}{tx.amount} {tx.fromCurrency}
              </Text>
              <Text 
                size="xs" 
                style={{
                  padding: '2px 8px',
                  borderRadius: '6px',
                  display: 'inline-block',
                  background: tx.status === 'completed' 
                    ? 'rgba(52, 199, 89, 0.1)' 
                    : 'rgba(255, 149, 0, 0.1)',
                  color: tx.status === 'completed' ? '#34C759' : '#FF9500'
                }}
              >
                {tx.status === 'completed' ? 'Завершено' : 'В обработке'}
              </Text>
            </div>
          </Group>
        </Paper>
      ))}
    </Stack>
  );
} 