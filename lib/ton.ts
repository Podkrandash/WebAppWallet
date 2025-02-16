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
  type: 'deposit' | 'withdrawal';
  amount: number;
  address?: string;
  status: string;
  timestamp: string;
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
    const address = Address.parse(addressStr);
    const balance = await client.getBalance(address);
    const balanceInTon = Number(fromNano(balance));
    
    // Обновляем цену TON каждые 5 минут
    const now = Date.now();
    if (now - lastPriceUpdate >= 5 * 60 * 1000) {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd');
        if (response.ok) {
          const data = await response.json();
          cachedPrice = data['the-open-network'].usd;
          lastPriceUpdate = now;
        }
      } catch (error) {
        console.error('Ошибка обновления цены:', error);
      }
    }
    
    return {
      balance: balanceInTon,
      usdValue: (balanceInTon * cachedPrice).toFixed(2)
    };
  } catch (error) {
    console.error('Ошибка получения баланса:', error);
    throw error;
  }
}

export async function getTransactions(addressStr: string): Promise<Transaction[]> {
  try {
    const response = await fetch('/api/transactions', {
      headers: {
        'x-telegram-init-data': window.Telegram?.WebApp?.initData || ''
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Ошибка получения транзакций');
    }

    return await response.json();
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
    // Проверяем данные Telegram
    const telegramUser = await verifyTelegramWebAppData(initData);
    if (!telegramUser) {
      throw new Error('Ошибка проверки данных Telegram');
    }

    // Проверяем баланс
    const { balance } = await getBalance(fromAddressStr);
    const totalAmount = amount + COMMISSION_FEE;
    
    if (balance < totalAmount) {
      throw new Error(`Недостаточно средств. Нужно: ${totalAmount} TON (включая комиссию ${COMMISSION_FEE} TON)`);
    }

    // Получаем данные кошелька
    const walletData = await localforage.getItem<WalletData>('wallet');
    if (!walletData) {
      throw new Error('Кошелёк не найден');
    }

    // Расшифровываем приватный ключ
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

    const keyPair: KeyPair = {
      publicKey: Buffer.from(walletData.publicKey, 'hex'),
      secretKey: Buffer.from(secretKey)
    };

    const wallet = WalletContractV4.create({
      publicKey: keyPair.publicKey,
      workchain: 0
    });

    const contract = client.open(wallet);
    const seqno = await contract.getSeqno();
    
    // Отправляем платёж и комиссию
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

    // Сохраняем транзакцию в базе данных
    const dbWallet = await prisma.wallet.findUnique({
      where: { address: fromAddressStr }
    });

    if (dbWallet) {
      await prisma.transaction.create({
        data: {
          type: 'withdrawal',
          amount: totalAmount,
          address: toAddressStr,
          userId: dbWallet.userId,
          timestamp: new Date()
        }
      });
    }

    return true;
  } catch (error) {
    console.error('Ошибка отправки TON:', error);
    throw error;
  }
} 