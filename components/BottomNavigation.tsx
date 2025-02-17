import { Paper, UnstyledButton, Stack, Text, Box } from '@mantine/core';
import { IconWallet, IconClockHour4 } from '@tabler/icons-react';

interface BottomNavigationProps {
  active: 'wallet' | 'history';
  onNavigate: (page: 'wallet' | 'history') => void;
}

export default function BottomNavigation({ active, onNavigate }: BottomNavigationProps) {
  return (
    <Paper 
      style={{ 
        position: 'fixed', 
        bottom: 0,
        left: 0,
        right: 0,
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderRadius: '24px 24px 0 0',
        border: '1px solid rgba(0, 0, 0, 0.1)',
        zIndex: 1000,
        padding: '16px 24px',
        boxShadow: '0 -8px 16px rgba(0, 0, 0, 0.03)'
      }}
    >
      <Box 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          maxWidth: '400px',
          margin: '0 auto'
        }}
      >
        <UnstyledButton 
          onClick={() => onNavigate('wallet')}
          style={{ 
            padding: '12px',
            borderRadius: '16px',
            background: active === 'wallet' ? 'rgba(10, 132, 255, 0.1)' : 'transparent',
            transition: 'all 0.2s ease'
          }}
        >
          <Stack align="center" gap={8}>
            <IconWallet 
              size={24}
              color={active === 'wallet' ? '#0A84FF' : '#8E8E93'} 
              style={{ transition: 'color 0.2s ease' }}
            />
            <Text 
              size="sm"
              fw={500}
              c={active === 'wallet' ? 'blue' : 'dimmed'}
              style={{ transition: 'color 0.2s ease' }}
            >
              Кошелёк
            </Text>
          </Stack>
        </UnstyledButton>

        <UnstyledButton 
          onClick={() => onNavigate('history')}
          style={{ 
            padding: '12px',
            borderRadius: '16px',
            background: active === 'history' ? 'rgba(10, 132, 255, 0.1)' : 'transparent',
            transition: 'all 0.2s ease'
          }}
        >
          <Stack align="center" gap={8}>
            <IconClockHour4 
              size={24}
              color={active === 'history' ? '#0A84FF' : '#8E8E93'} 
              style={{ transition: 'color 0.2s ease' }}
            />
            <Text 
              size="sm"
              fw={500}
              c={active === 'history' ? 'blue' : 'dimmed'}
              style={{ transition: 'color 0.2s ease' }}
            >
              История
            </Text>
          </Stack>
        </UnstyledButton>
      </Box>
    </Paper>
  );
} 