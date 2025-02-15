import { TonClient, Address, fromNano, toNano, beginCell, internal } from '@ton/ton';
import { getSecureRandomBytes, KeyPair, keyPairFromSeed } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import localforage from 'localforage';
import { verifyTelegramWebAppData } from '../utils/telegram';

const client = new TonClient({
  endpoint: 'https://toncenter.com/api/v2/jsonRPC'
});

// Инициализация хранилища с префиксом telegramId
const getStorage = (telegramId: string) => localforage.createInstance({
  name: `ton_wallet_${telegramId}`
});

interface WalletData {
  address: string;
  publicKey: string;
  encryptedKey: string;
  seed?: string;
  telegramId: string; // Добавляем привязку к Telegram ID
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
  telegramId: string, // Добавляем Telegram ID в данные синхронизации
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
const syncIntervals = new Map<string, NodeJS.Timeout>();

export function startBalanceSync(address: string, telegramId: string) {
  if (syncIntervals.has(address)) {
    clearInterval(syncIntervals.get(address)!);
  }

  const storage = getStorage(telegramId);
  
  // Сразу получаем и синхронизируем баланс
  getBalance(address).catch(console.error);

  const interval = setInterval(async () => {
    try {
      const { balance } = await getBalance(address);
      
      // Получаем предыдущий баланс из локального хранилища
      const prevBalance = await storage.getItem<number>(`balance_${address}`);
      
      // Если баланс изменился, синхронизируем с ботом
      if (prevBalance !== balance) {
        await storage.setItem(`balance_${address}`, balance);
        await syncWithBot({
          type: 'balance_update',
          address,
          telegramId,
          balance
        });
      }
    } catch (error) {
      console.error('Error in balance sync:', error);
    }
  }, 30000);

  syncIntervals.set(address, interval);
}

export function stopBalanceSync(address: string) {
  if (syncIntervals.has(address)) {
    clearInterval(syncIntervals.get(address)!);
    syncIntervals.delete(address);
  }
}

export async function initWallet(initData: string): Promise<WalletData | null> {
  try {
    // Проверяем и получаем данные пользователя Telegram
    const telegramUser = await verifyTelegramWebAppData(initData);
    if (!telegramUser) {
      throw new Error('Invalid Telegram WebApp data');
    }

    const telegramId = telegramUser.id.toString();
    const storage = getStorage(telegramId);

    // Проверяем, есть ли уже кошелек в локальном хранилище
    const existingWallet = await storage.getItem<WalletData>('wallet');
    if (existingWallet) {
      console.log('Using existing wallet');
      // Проверяем, что кошелек принадлежит этому пользователю
      if (existingWallet.telegramId === telegramId) {
        startBalanceSync(existingWallet.address, telegramId);
        return existingWallet;
      }
    }

    console.log('Creating new wallet');
    // Создаем новый кошелек
    const seed = await getSecureRandomBytes(32);
    const keyPair = keyPairFromSeed(seed);
    const wallet = WalletContractV4.create({ 
      publicKey: keyPair.publicKey,
      workchain: 0 
    });

    // Шифруем приватный ключ
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
      encryptedKey: Buffer.from(encryptedKey).toString('hex'),
      seed: Buffer.from(seed).toString('hex'),
      telegramId // Сохраняем Telegram ID
    };

    // Сохраняем данные кошелька
    await storage.setItem('wallet', walletData);
    console.log('Wallet created and saved');

    // Запускаем синхронизацию для нового кошелька
    startBalanceSync(walletData.address, telegramId);

    // Синхронизируем с ботом новый кошелек
    await syncWithBot({
      type: 'balance_update',
      address: walletData.address,
      telegramId,
      balance: 0
    });

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
    const balanceInTon = Number(fromNano(balance));
    
    // Получаем курс TON/USD (в реальном приложении нужно использовать API биржи)
    const tonPrice = 3.5; // Пример фиксированной цены
    
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
    // Проверяем и получаем данные пользователя Telegram
    const telegramUser = await verifyTelegramWebAppData(initData);
    if (!telegramUser) {
      throw new Error('Invalid Telegram WebApp data');
    }

    const telegramId = telegramUser.id.toString();
    const storage = getStorage(telegramId);

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
      telegramId,
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