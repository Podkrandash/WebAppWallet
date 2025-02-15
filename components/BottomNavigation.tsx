import { Group, UnstyledButton, Stack, Text } from '@mantine/core';
import { IconWallet, IconClockHour4 } from '@tabler/icons-react';

interface BottomNavigationProps {
  active: 'wallet' | 'history';
  onNavigate: (page: 'wallet' | 'history') => void;
}

export default function BottomNavigation({ active, onNavigate }: BottomNavigationProps) {
  return (
    <Group 
      justify="space-between"
      p="md" 
      style={{ 
        position: 'fixed', 
        bottom: 0, 
        left: 0, 
        right: 0,
        background: 'white',
        borderTop: '1px solid #eee'
      }}
    >
      <UnstyledButton 
        onClick={() => onNavigate('wallet')}
        style={{ flex: 1 }}
      >
        <Stack align="center" gap={4}>
          <IconWallet 
            size={24} 
            color={active === 'wallet' ? '#228be6' : '#868e96'} 
          />
          <Text 
            size="xs" 
            c={active === 'wallet' ? 'blue' : 'dimmed'}
          >
            Кошелёк
          </Text>
        </Stack>
      </UnstyledButton>

      <UnstyledButton 
        onClick={() => onNavigate('history')}
        style={{ flex: 1 }}
      >
        <Stack align="center" gap={4}>
          <IconClockHour4 
            size={24} 
            color={active === 'history' ? '#228be6' : '#868e96'} 
          />
          <Text 
            size="xs" 
            c={active === 'history' ? 'blue' : 'dimmed'}
          >
            История
          </Text>
        </Stack>
      </UnstyledButton>
    </Group>
  );
} 