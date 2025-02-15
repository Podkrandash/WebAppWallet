import { useEffect, useState } from 'react';
import { Container, Title, Text, LoadingOverlay } from '@mantine/core';
import { useRouter } from 'next/router';
import WalletCard from '../components/WalletCard';
import { getWallet } from '../lib/api';

interface WalletData {
  balance: number;
  address: string;
}

export default function Home() {
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const { token } = router.query;

  useEffect(() => {
    if (token && typeof token === 'string') {
      getWallet(token)
        .then(data => setWallet(data))
        .catch(err => console.error('Error fetching wallet:', err))
        .finally(() => setLoading(false));
    }
  }, [token]);

  const handleDeposit = () => {
    // TODO: Implement deposit logic
    console.log('Deposit clicked');
  };

  const handleWithdraw = () => {
    // TODO: Implement withdraw logic
    console.log('Withdraw clicked');
  };

  return (
    <Container size="md" py="xl" pos="relative">
      <LoadingOverlay visible={loading} />
      
      <Title order={1} mb="lg">Earth Wallet</Title>
      
      {wallet ? (
        <WalletCard
          balance={wallet.balance}
          address={wallet.address}
          onDeposit={handleDeposit}
          onWithdraw={handleWithdraw}
        />
      ) : !loading && (
        <Text>Кошелек не найден. Пожалуйста, перейдите по ссылке из бота.</Text>
      )}
    </Container>
  );
} 