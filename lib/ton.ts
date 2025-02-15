import { TonClient, Address, fromNano, toNano, beginCell } from '@ton/ton';
import { getSecureRandomBytes, KeyPair, keyPairFromSeed } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import localforage from 'localforage';

const client = new TonClient({
  endpoint: 'https://toncenter.com/api/v2/jsonRPC'
});

// Инициализация хранилища
const storage = localforage.createInstance({
  name: 'ton_wallet'
});

interface WalletData {
  address: string;
  publicKey: string;
  encryptedKey: string;
}

export interface Transaction {
  type: 'deposit' | 'withdrawal';
  amount: number;
  fromCurrency: string;
  status: string;
  timestamp: string;
}

export async function initWallet(initData: string): Promise<WalletData | null> {
  try {
    // Проверяем, есть ли уже кошелек
    const existingWallet = await storage.getItem<WalletData>('wallet');
    if (existingWallet) {
      return existingWallet;
    }

    // Создаем новый кошелек
    const seed = await getSecureRandomBytes(32);
    const keyPair = keyPairFromSeed(seed);
    const wallet = WalletContractV4.create({ 
      publicKey: keyPair.publicKey,
      workchain: 0 
    });

    // Шифруем приватный ключ с помощью initData как ключа
    const encoder = new TextEncoder();
    const encryptedKey = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: encoder.encode(initData.slice(0, 12))
      },
      await crypto.subtle.importKey(
        'raw',
        encoder.encode(initData),
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      ),
      keyPair.secretKey
    );

    const walletData: WalletData = {
      address: wallet.address.toString(),
      publicKey: Buffer.from(keyPair.publicKey).toString('hex'),
      encryptedKey: Buffer.from(encryptedKey).toString('hex')
    };

    // Сохраняем данные кошелька
    await storage.setItem('wallet', walletData);

    return walletData;
  } catch (error) {
    console.error('Error initializing wallet:', error);
    return null;
  }
}

export async function getBalance(addressStr: string): Promise<{ balance: number; usdValue: string }> {
  try {
    const address = Address.parse(addressStr);
    const balance = await client.getBalance(address);
    
    // Получаем курс TON/USD (в реальном приложении нужно использовать API биржи)
    const tonPrice = 3.5; // Пример фиксированной цены
    const balanceInTon = Number(fromNano(balance));
    
    return {
      balance: balanceInTon,
      usdValue: (balanceInTon * tonPrice).toFixed(2)
    };
  } catch (error) {
    console.error('Error getting balance:', error);
    throw error;
  }
}

export async function getTransactions(addressStr: string, limit: number = 10): Promise<Transaction[]> {
  try {
    const address = Address.parse(addressStr);
    const transactions = await client.getTransactions(address, { limit });

    return transactions.map(tx => {
      let amount = 0;
      let type: 'deposit' | 'withdrawal' = 'withdrawal';

      // Проверяем входящие сообщения
      if (tx.inMessage && tx.inMessage.info.type === 'internal') {
        const value = tx.inMessage.info.value.coins;
        if (value > 0n) {
          amount = Number(fromNano(value));
          type = 'deposit';
        }
      } 
      // Проверяем исходящие сообщения
      else if (tx.outMessages.size > 0) {
        const outMsg = Array.from(tx.outMessages.values())[0];
        if (outMsg.info.type === 'internal') {
          amount = Number(fromNano(outMsg.info.value.coins));
        }
      }

      return {
        type,
        amount,
        fromCurrency: 'TON',
        status: 'completed',
        timestamp: new Date(Number(tx.now) * 1000).toISOString()
      };
    });
  } catch (error) {
    console.error('Error getting transactions:', error);
    throw error;
  }
}

export async function sendTON(
  fromAddressStr: string,
  toAddressStr: string,
  amount: number,
  initData: string
): Promise<boolean> {
  try {
    const walletData = await storage.getItem<WalletData>('wallet');
    if (!walletData) throw new Error('Wallet not found');

    // Расшифровываем приватный ключ
    const encoder = new TextEncoder();
    const secretKey = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: encoder.encode(initData.slice(0, 12))
      },
      await crypto.subtle.importKey(
        'raw',
        encoder.encode(initData),
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      ),
      Buffer.from(walletData.encryptedKey, 'hex')
    );

    const keyPair: KeyPair = {
      publicKey: Buffer.from(walletData.publicKey, 'hex'),
      secretKey: Buffer.from(secretKey)
    };

    const wallet = WalletContractV4.create({
      publicKey: keyPair.publicKey,
      workchain: 0
    });

    const toAddress = Address.parse(toAddressStr);
    const contract = client.open(wallet);
    const seqno = await contract.getSeqno();
    
    await contract.sendTransfer({
      secretKey: keyPair.secretKey,
      seqno,
      messages: [{
        info: {
          type: 'internal',
          dest: toAddress,
          value: { coins: toNano(amount.toString()) },
          bounce: false,
          ihrDisabled: true,
          bounced: false,
          body: beginCell().endCell()
        }
      }]
    });

    return true;
  } catch (error) {
    console.error('Error sending TON:', error);
    throw error;
  }
} 