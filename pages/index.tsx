import { useEffect, useState } from 'react';
import { Container, LoadingOverlay, Stack } from '@mantine/core';
import { useRouter } from 'next/router';
import WalletCard from '../components/WalletCard';
import TransactionHistory from '../components/TransactionHistory';
import BottomNavigation from '../components/BottomNavigation';
import { getWallet, getTransactions } from '../lib/api';

interface WalletData {
  balance: number;
  usdValue: string;
  address: string;
}

interface Transaction {
  type: 'deposit' | 'withdrawal';
  amount: number;
  fromCurrency: string;
  status: string;
  timestamp: string;
}

export default function Home() {
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState<'wallet' | 'history'>('wallet');
  const { initData } = router.query;

  useEffect(() => {
    if (initData && typeof initData === 'string') {
      Promise.all([
        getWallet(initData),
        getTransactions(initData)
      ])
        .then(([walletData, txData]) => {
          setWallet(walletData);
          setTransactions(txData);
        })
        .catch(err => console.error('Error fetching data:', err))
        .finally(() => setLoading(false));
    }
  }, [initData]);

  const handleSend = () => {
    // TODO: Implement send functionality
    console.log('Send clicked');
  };

  const handleReceive = () => {
    // TODO: Implement receive functionality
    console.log('Receive clicked');
  };

  const handleQRCode = () => {
    // TODO: Implement QR code functionality
    console.log('QR code clicked');
  };

  return (
    <Container size="sm" py="xl" pb={80} pos="relative">
      <LoadingOverlay visible={loading} />
      
      <Stack spacing="xl">
        {activePage === 'wallet' && wallet && (
          <WalletCard
            balance={wallet.balance}
            usdValue={wallet.usdValue}
            address={wallet.address}
            onSend={handleSend}
            onReceive={handleReceive}
            onQRCode={handleQRCode}
          />
        )}

        {activePage === 'history' && (
          <TransactionHistory transactions={transactions} />
        )}
      </Stack>

      <BottomNavigation
        active={activePage}
        onNavigate={setActivePage}
      />
    </Container>
  );
} 