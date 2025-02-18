import { TonClient, Address, fromNano, toNano, beginCell, internal } from '@ton/ton';
import { getSecureRandomBytes, KeyPair, keyPairFromSeed } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import localforage from 'localforage';
import { verifyTelegramWebAppData } from '../utils/telegram';
import { prisma } from './prisma';

// Инициализация TON клиента
const client = new TonClient({
  endpoint: 'https://toncenter.com/api/v2/jsonRPC',
  apiKey: process.env.TONCENTER_API_KEY
});

// Комиссия в TON
const COMMISSION_FEE = 0.05;
const COMMISSION_ADDRESS = process.env.COMMISSION_WALLET_ADDRESS;

// Кэш для цены TON
const FALLBACK_PRICE = 3.5;
let lastPriceUpdate = 0;
let cachedPrice = FALLBACK_PRICE;

interface WalletData {
  address: string;
  publicKey: string;
  encryptedKey: string;
}

export interface Transaction {
  id: string;
  type: string;  // 'deposit' или 'withdrawal'
  amount: number;
  address: string | null;
  status: string;
  timestamp: string;
  hash: string;
  fee: number;
  userId: number;
}

export async function initWallet(initData: string): Promise<WalletData | null> {
  try {
    const response = await fetch('/api/wallet', {
      headers: {
        'x-telegram-init-data': initData
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Ошибка инициализации кошелька');
    }

    const walletData = await response.json();
    await localforage.setItem('wallet', walletData);
    return walletData;
  } catch (error) {
    console.error('Ошибка инициализации кошелька:', error);
    throw error;
  }
}

export async function getBalance(addressStr: string): Promise<{ balance: number; usdValue: string }> {
  try {
    console.log('Получаем баланс для адреса:', addressStr);
    const address = Address.parse(addressStr);
    const balance = await client.getBalance(address);
    const balanceInTon = Number(fromNano(balance));
    console.log('Текущий баланс:', balanceInTon, 'TON');
    
    // Обновляем цену TON каждые 5 минут
    const now = Date.now();
    if (now - lastPriceUpdate >= 5 * 60 * 1000) {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd');
        if (response.ok) {
          const data = await response.json();
          cachedPrice = data['the-open-network'].usd;
          lastPriceUpdate = now;
          console.log('Обновлена цена TON:', cachedPrice, 'USD');
        }
      } catch (error) {
        console.error('Ошибка обновления цены:', error);
      }
    }
    
    const result = {
      balance: balanceInTon,
      usdValue: (balanceInTon * cachedPrice).toFixed(2)
    };
    console.log('Возвращаем данные баланса:', result);
    return result;
  } catch (error) {
    console.error('Ошибка получения баланса:', error);
    throw error;
  }
}

export async function getTransactions(addressStr: string): Promise<Transaction[]> {
  try {
    console.log('Получаем транзакции для адреса:', addressStr);
    const response = await fetch('/api/transactions', {
      headers: {
        'x-telegram-init-data': window.Telegram?.WebApp?.initData || ''
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Ошибка получения транзакций');
    }

    const transactions = await response.json();
    console.log('Получены транзакции:', transactions);
    return transactions;
  } catch (error) {
    console.error('Ошибка получения транзакций:', error);
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
    console.log('Отправка TON:', {
      from: fromAddressStr,
      to: toAddressStr,
      amount: amount,
      commission: COMMISSION_FEE
    });

    // Проверяем баланс
    const { balance } = await getBalance(fromAddressStr);
    const totalAmount = amount + COMMISSION_FEE;
    console.log('Проверка баланса:', {
      balance: balance,
      required: totalAmount,
      difference: balance - totalAmount
    });
    
    if (balance < totalAmount) {
      throw new Error(`Недостаточно средств. Нужно: ${totalAmount} TON (включая комиссию ${COMMISSION_FEE} TON)`);
    }

    // Получаем данные кошелька
    const walletData = await localforage.getItem<WalletData>('wallet');
    if (!walletData) {
      throw new Error('Кошелёк не найден');
    }

    console.log('Подготовка транзакции...');
    const keyPair = await decryptKeyPair(walletData, initData);
    const wallet = WalletContractV4.create({
      publicKey: keyPair.publicKey,
      workchain: 0
    });

    const contract = client.open(wallet);
    const seqno = await contract.getSeqno();
    console.log('Текущий seqno:', seqno);
    
    // Отправляем платёж и комиссию
    console.log('Отправка транзакций...');
    await contract.sendTransfer({
      secretKey: keyPair.secretKey,
      seqno,
      timeout: 60000,
      messages: [
        internal({
          to: Address.parse(toAddressStr),
          value: toNano(amount.toString()),
          bounce: false,
          body: beginCell().endCell()
        }),
        internal({
          to: Address.parse(COMMISSION_ADDRESS || ''),
          value: toNano(COMMISSION_FEE.toString()),
          bounce: false,
          body: beginCell().endCell()
        })
      ]
    });
    console.log('Транзакции отправлены успешно');

    // Сохраняем в базу данных
    const response = await fetch('/api/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-init-data': initData
      },
      body: JSON.stringify({
        type: 'withdrawal',
        amount: amount,
        address: toAddressStr,
        hash: seqno.toString(),
        fee: COMMISSION_FEE
      })
    });

    if (!response.ok) {
      console.error('Ошибка сохранения транзакции:', await response.json());
    } else {
      console.log('Транзакция сохранена в базе данных');
    }

    return true;
  } catch (error) {
    console.error('Ошибка отправки TON:', error);
    throw error;
  }
}

// Вспомогательная функция для расшифровки ключей
async function decryptKeyPair(walletData: WalletData, initData: string): Promise<KeyPair> {
  console.log('Расшифровка ключей кошелька...');
  const encoder = new TextEncoder();
  const secretKey = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: encoder.encode(initData.slice(0, 12))
    },
    await crypto.subtle.importKey(
      'raw',
      encoder.encode(process.env.ENCRYPTION_KEY || ''),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    ),
    Buffer.from(walletData.encryptedKey, 'hex')
  );

  return {
    publicKey: Buffer.from(walletData.publicKey, 'hex'),
    secretKey: Buffer.from(secretKey)
  };
} 