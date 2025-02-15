import { Paper, UnstyledButton, Stack, Text, Box } from '@mantine/core';
import { IconWallet, IconClockHour4 } from '@tabler/icons-react';

interface BottomNavigationProps {
  active: 'wallet' | 'history';
  onNavigate: (page: 'wallet' | 'history') => void;
}

export default function BottomNavigation({ active, onNavigate }: BottomNavigationProps) {
  return (
    <Paper 
      shadow="sm"
      p="md" 
      style={{ 
        position: 'fixed', 
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 32px)',
        maxWidth: '400px',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderRadius: '20px',
        border: '1px solid rgba(0, 0, 0, 0.1)'
      }}
    >
      <Box 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr',
          gap: '8px'
        }}
      >
        <UnstyledButton 
          onClick={() => onNavigate('wallet')}
          style={{ 
            padding: '8px',
            borderRadius: '16px',
            background: active === 'wallet' ? 'rgba(10, 132, 255, 0.1)' : 'transparent'
          }}
        >
          <Stack align="center" gap={4}>
            <IconWallet 
              size={24} 
              color={active === 'wallet' ? '#0A84FF' : '#8E8E93'} 
              style={{ 
                transition: 'color 0.2s ease'
              }}
            />
            <Text 
              size="xs" 
              fw={500}
              c={active === 'wallet' ? 'blue' : 'dimmed'}
              style={{ 
                transition: 'color 0.2s ease'
              }}
            >
              Кошелёк
            </Text>
          </Stack>
        </UnstyledButton>

        <UnstyledButton 
          onClick={() => onNavigate('history')}
          style={{ 
            padding: '8px',
            borderRadius: '16px',
            background: active === 'history' ? 'rgba(10, 132, 255, 0.1)' : 'transparent'
          }}
        >
          <Stack align="center" gap={4}>
            <IconClockHour4 
              size={24} 
              color={active === 'history' ? '#0A84FF' : '#8E8E93'} 
              style={{ 
                transition: 'color 0.2s ease'
              }}
            />
            <Text 
              size="xs" 
              fw={500}
              c={active === 'history' ? 'blue' : 'dimmed'}
              style={{ 
                transition: 'color 0.2s ease'
              }}
            >
              История
            </Text>
          </Stack>
        </UnstyledButton>
      </Box>
    </Paper>
  );
} 