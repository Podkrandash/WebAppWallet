import { TonClient, Address, fromNano, toNano, beginCell, internal } from '@ton/ton';
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
  iv: string;
  seed?: string;
}

interface BotWalletResponse {
  address: string;
  balance: number;
  usdValue: string;
}

export interface Transaction {
  type: 'deposit' | 'withdrawal';
  amount: number;
  fromCurrency: string;
  status: string;
  timestamp: string;
}

// Функция для отправки обновлений боту
async function syncWithBot(data: {
  type: 'balance_update' | 'transaction',
  address: string,
  balance?: number,
  transaction?: {
    type: 'deposit' | 'withdrawal',
    amount: number,
    timestamp: number
  }
}) {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    window.Telegram.WebApp.sendData(JSON.stringify(data));
  }
}

// Функция для периодической синхронизации баланса
let syncInterval: NodeJS.Timeout | null = null;

export function startBalanceSync(address: string) {
  if (syncInterval) {
    clearInterval(syncInterval);
  }

  // Сразу получаем и синхронизируем баланс
  getBalance(address).catch(console.error);

  // Устанавливаем интервал синхронизации каждые 30 секунд
  syncInterval = setInterval(() => {
    getBalance(address).catch(console.error);
  }, 30000);
}

export function stopBalanceSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

export async function initWallet(initData: string): Promise<WalletData | null> {
  try {
    const existingWallet = await storage.getItem<WalletData>('wallet');
    if (existingWallet) {
      console.log('Using existing wallet');
      // Запускаем синхронизацию для существующего кошелька
      startBalanceSync(existingWallet.address);
      return existingWallet;
    }

    console.log('Creating new wallet');
    // Создаем новый кошелек
    const seed = await getSecureRandomBytes(32);
    const keyPair = keyPairFromSeed(seed);
    const wallet = WalletContractV4.create({ 
      publicKey: keyPair.publicKey,
      workchain: 0 
    });

    // Создаем ключ шифрования из initData
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.digest(
      'SHA-256',
      encoder.encode(initData)
    );

    // Создаем ключ для шифрования
    const key = await crypto.subtle.importKey(
      'raw',
      keyMaterial,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    // Генерируем IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Шифруем приватный ключ
    const encryptedKey = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      keyPair.secretKey
    );

    const walletData: WalletData = {
      address: wallet.address.toString(),
      publicKey: Buffer.from(keyPair.publicKey).toString('hex'),
      encryptedKey: Buffer.from(encryptedKey).toString('hex'),
      iv: Buffer.from(iv).toString('hex'),
      seed: Buffer.from(seed).toString('hex')
    };

    // Сохраняем данные кошелька
    await storage.setItem('wallet', walletData);
    console.log('Wallet created and saved');

    // Запускаем синхронизацию для нового кошелька
    startBalanceSync(walletData.address);
    return walletData;
  } catch (error) {
    console.error('Error in initWallet:', error);
    throw error;
  }
}

export async function getBalance(addressStr: string): Promise<{ balance: number; usdValue: string }> {
  try {
    const address = Address.parse(addressStr);
    const balance = await client.getBalance(address);
    
    // Получаем курс TON/USD (в реальном приложении нужно использовать API биржи)
    const tonPrice = 3.5; // Пример фиксированной цены
    const balanceInTon = Number(fromNano(balance));
    
    // Синхронизируем с ботом
    await syncWithBot({
      type: 'balance_update',
      address: addressStr,
      balance: balanceInTon
    });
    
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

    // Создаем ключ расшифровки из initData
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.digest(
      'SHA-256',
      encoder.encode(initData)
    );

    // Создаем ключ для расшифровки
    const key = await crypto.subtle.importKey(
      'raw',
      keyMaterial,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // Расшифровываем приватный ключ
    const secretKey = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: Buffer.from(walletData.iv, 'hex')
      },
      key,
      Buffer.from(walletData.encryptedKey, 'hex')
    );

    const keyPair: KeyPair = {
      publicKey: Buffer.from(walletData.publicKey, 'hex'),
      secretKey: Buffer.from(new Uint8Array(secretKey))
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
      timeout: 60000,
      messages: [
        internal({
          to: toAddress,
          value: toNano(amount.toString()),
          bounce: false,
          body: beginCell().endCell()
        })
      ]
    });

    // После успешной отправки синхронизируем с ботом
    await syncWithBot({
      type: 'transaction',
      address: fromAddressStr,
      transaction: {
        type: 'withdrawal',
        amount: amount,
        timestamp: Date.now()
      }
    });

    return true;
  } catch (error) {
    console.error('Error sending TON:', error);
    throw error;
  }
} 