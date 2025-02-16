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
  telegramId: string,
  publicKey?: string,
  encryptedKey?: string,
  balance?: number,
  transaction?: {
    type: 'deposit' | 'withdrawal',
    amount: number,
    timestamp: number
  }
}) {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    // Получаем данные кошелька из хранилища
    const storage = getStorage(data.telegramId);
    const walletData = await storage.getItem<WalletData>('wallet');

    // Добавляем publicKey и encryptedKey к данным, если их нет
    if (data.type === 'balance_update' && walletData) {
      data.publicKey = data.publicKey || walletData.publicKey;
      data.encryptedKey = data.encryptedKey || walletData.encryptedKey;
    }

    window.Telegram.WebApp.sendData(JSON.stringify(data));
  }
}

// Функция для периодической синхронизации баланса
const syncIntervals = new Map<string, NodeJS.Timeout>();

// Добавляем кэш для баланса и цены
const balanceCache = new Map<string, { balance: number; timestamp: number }>();
const priceCache = new Map<string, { price: number; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // Увеличиваем до 30 минут
const PRICE_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 минут между обновлениями цены
const FALLBACK_PRICE = 3.5;
let lastPriceUpdate = 0;

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
  }, 60000); // Увеличиваем интервал до 1 минуты

  syncIntervals.set(address, interval);
}

export function stopBalanceSync(address: string) {
  if (syncIntervals.has(address)) {
    clearInterval(syncIntervals.get(address)!);
    syncIntervals.delete(address);
  }
}

// Функция для получения кошелька от бота
async function getWalletFromBot(telegramId: string): Promise<WalletData | null> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/wallet?telegramId=${telegramId}`,
      {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        credentials: 'include'
      }
    );
    
    if (response.status === 404) {
      console.log('Wallet not found for telegramId:', telegramId);
      return null;
    }
    
    if (!response.ok) {
      throw new Error(`Failed to get wallet: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Received wallet data:', data);
    
    return {
      address: data.address,
      publicKey: data.publicKey,
      encryptedKey: data.encryptedKey,
      telegramId
    };
  } catch (error) {
    console.error('Error getting wallet from bot:', error);
    return null;
  }
}

// Функция для очистки всех хранилищ
async function clearAllStorages() {
  try {
    // Получаем список всех хранилищ
    const stores = await localforage.keys();
    
    // Очищаем каждое хранилище
    for (const store of stores) {
      const instance = localforage.createInstance({ name: store });
      await instance.clear();
    }
    
    // Очищаем кэши
    balanceCache.clear();
    priceCache.clear();
    syncIntervals.forEach((interval) => clearInterval(interval));
    syncIntervals.clear();
    
    console.log('All storages cleared');
  } catch (error) {
    console.error('Error clearing storages:', error);
  }
}

export async function initWallet(initData: string): Promise<WalletData | null> {
  try {
    const telegramUser = await verifyTelegramWebAppData(initData);
    if (!telegramUser) {
      console.error('Invalid Telegram WebApp data');
      return null;
    }

    const telegramId = telegramUser.id.toString();
    
    // Очищаем все старые хранилища перед инициализацией
    await clearAllStorages();
    
    const storage = getStorage(telegramId);

    // Всегда пытаемся получить актуальный кошелек от бота
    const botWallet = await getWalletFromBot(telegramId);
    if (botWallet) {
      console.log('Using wallet from bot');
      await storage.setItem('wallet', botWallet);
      startBalanceSync(botWallet.address, telegramId);
      return botWallet;
    }

    // Если кошелек не найден у бота, возвращаем ошибку
    throw new Error('Wallet not found. Please start the bot first with /start command');
  } catch (error) {
    console.error('Error in initWallet:', error);
    throw error;
  }
}

export async function getBalance(addressStr: string): Promise<{ balance: number; usdValue: string }> {
  try {
    // Получаем баланс
    const address = Address.parse(addressStr);
    const balance = await client.getBalance(address);
    const balanceInTon = Number(fromNano(balance));
    
    const now = Date.now();
    
    // Обновляем кэш баланса
    balanceCache.set(addressStr, {
      balance: balanceInTon,
      timestamp: now
    });

    // Проверяем, нужно ли обновлять цену
    if (now - lastPriceUpdate >= PRICE_UPDATE_INTERVAL) {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd', {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Earth Wallet WebApp'
          }
        });

        if (response.ok) {
          const data = await response.json();
          const price = data['the-open-network'].usd;
          
          priceCache.set('TON', {
            price,
            timestamp: now
          });
          lastPriceUpdate = now;
          
          return {
            balance: balanceInTon,
            usdValue: (balanceInTon * price).toFixed(2)
          };
        }
      } catch (error) {
        console.error('Error updating price:', error);
      }
    }
    
    // Используем кэшированную цену или фиксированную
    const cachedPrice = priceCache.get('TON');
    const price = cachedPrice ? cachedPrice.price : FALLBACK_PRICE;
    
    return {
      balance: balanceInTon,
      usdValue: (balanceInTon * price).toFixed(2)
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