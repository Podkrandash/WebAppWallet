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
        position: 'sticky', 
        bottom: 0,
        width: '100%',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderRadius: '20px 20px 0 0',
        border: '1px solid rgba(0, 0, 0, 0.1)',
        zIndex: 1000,
        padding: 'clamp(8px, 3vw, 16px)'
      }}
    >
      <Box 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr',
          gap: 'clamp(4px, 2vw, 8px)',
          maxWidth: '400px',
          margin: '0 auto'
        }}
      >
        <UnstyledButton 
          onClick={() => onNavigate('wallet')}
          style={{ 
            padding: 'clamp(6px, 2vw, 8px)',
            borderRadius: '16px',
            background: active === 'wallet' ? 'rgba(10, 132, 255, 0.1)' : 'transparent'
          }}
        >
          <Stack align="center" gap={4}>
            <IconWallet 
              size={clamp(20, 6, 24)} 
              color={active === 'wallet' ? '#0A84FF' : '#8E8E93'} 
              style={{ 
                transition: 'color 0.2s ease'
              }}
            />
            <Text 
              style={{ 
                fontSize: `${clamp(11, 3, 12)}px`,
                transition: 'color 0.2s ease'
              }}
              fw={500}
              c={active === 'wallet' ? 'blue' : 'dimmed'}
            >
              Кошелёк
            </Text>
          </Stack>
        </UnstyledButton>

        <UnstyledButton 
          onClick={() => onNavigate('history')}
          style={{ 
            padding: 'clamp(6px, 2vw, 8px)',
            borderRadius: '16px',
            background: active === 'history' ? 'rgba(10, 132, 255, 0.1)' : 'transparent'
          }}
        >
          <Stack align="center" gap={4}>
            <IconClockHour4 
              size={clamp(20, 6, 24)}
              color={active === 'history' ? '#0A84FF' : '#8E8E93'} 
              style={{ 
                transition: 'color 0.2s ease'
              }}
            />
            <Text 
              style={{ 
                fontSize: `${clamp(11, 3, 12)}px`,
                transition: 'color 0.2s ease'
              }}
              fw={500}
              c={active === 'history' ? 'blue' : 'dimmed'}
            >
              История
            </Text>
          </Stack>
        </UnstyledButton>
      </Box>
    </Paper>
  );
}

// Вспомогательная функция для расчета размера
function clamp(min: number, vw: number, max: number): number {
  return Math.min(Math.max(min, window.innerWidth * vw / 100), max);
} 