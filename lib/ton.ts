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

// Добавляем адрес контракта USDT в сети TON
const USDT_CONTRACT_ADDRESS = 'EQBynBO23ywHy_CgarY9NK9FTz0yDsG82PtcbSTQgGoXwiuA';

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

export async function getBalance(addressStr: string): Promise<{ 
  balance: number; 
  usdValue: string;
  tonPrice: number;
  usdtBalance: number;
}> {
  try {
    console.log('Получаем баланс для адреса:', addressStr);
    const address = Address.parse(addressStr);
    
    // Получаем баланс TON
    const balance = await client.getBalance(address);
    const balanceInTon = Number(fromNano(balance));
    console.log('Баланс в TON:', balanceInTon);
    
    // Получаем баланс USDT
    const usdtBalance = await getUSDTBalance(address);
    console.log('Баланс в USDT:', usdtBalance);
    
    // Получаем актуальный курс TON в рублях
    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=rub',
        {
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        const tonPrice = data['the-open-network'].rub;
        console.log('Текущая цена TON:', tonPrice, 'RUB');
        
        // Считаем стоимость баланса в рублях
        const balanceInRub = balanceInTon * tonPrice;
        console.log('Баланс в рублях:', balanceInRub);
        
        return {
          balance: balanceInTon,
          usdValue: balanceInRub.toFixed(2),
          tonPrice: tonPrice,
          usdtBalance
        };
      }
    } catch (error) {
      console.error('Ошибка получения курса:', error);
    }
    
    // Если не удалось получить курс, возвращаем запасной вариант
    return {
      balance: balanceInTon,
      usdValue: '0.00',
      tonPrice: 0,
      usdtBalance
    };
  } catch (error) {
    console.error('Ошибка получения баланса:', error);
    throw error;
  }
}

// Функция для получения баланса USDT
async function getUSDTBalance(address: Address): Promise<number> {
  try {
    const usdtContract = WalletContractV4.create({
      publicKey: Buffer.alloc(32),
      workchain: 0
    });
    const contract = client.open(usdtContract);
    const result = await contract.getBalance();
    return Number(fromNano(result));
  } catch (error) {
    console.error('Ошибка получения баланса USDT:', error);
    return 0;
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
    console.log('=== Начало отправки TON ===');
    
    // Базовые проверки
    if (!toAddressStr.startsWith('UQ')) {
      throw new Error('Неверный формат адреса получателя. Адрес должен начинаться с UQ');
    }

    // Проверяем и парсим адреса
    const fromAddress = Address.parse(fromAddressStr);
    const toAddress = Address.parse(toAddressStr);
    
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

    // Расшифровываем ключи
    const keyPair = await decryptKeyPair(walletData, initData);

    // Создаем и инициализируем кошелек
    const wallet = WalletContractV4.create({
      publicKey: keyPair.publicKey,
      workchain: 0
    });

    const contract = client.open(wallet);
    const seqno = await contract.getSeqno();

    // Отправляем основной платеж
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

    // Ждем подтверждения основной транзакции
    let attempts = 0;
    while (attempts < 10) {
      const transactions = await client.getTransactions(wallet.address, { limit: 1 });
      if (transactions.length > 0 && transactions[0].now > Date.now() - 60000) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 3000));
      attempts++;
    }

    // Отправляем комиссию отдельной транзакцией
    if (COMMISSION_ADDRESS) {
      const newSeqno = await contract.getSeqno();
      await contract.sendTransfer({
        secretKey: keyPair.secretKey,
        seqno: newSeqno,
        timeout: 60000,
        messages: [
          internal({
            to: Address.parse(COMMISSION_ADDRESS),
            value: toNano(COMMISSION_FEE.toString()),
            bounce: false,
            body: beginCell().endCell()
          })
        ]
      });
    }

    // Сохраняем в базу данных с правильными enum значениями
    const response = await fetch('/api/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-init-data': initData
      },
      body: JSON.stringify({
        type: 'WITHDRAWAL',
        amount: amount,
        address: toAddressStr,
        hash: seqno.toString(),
        fee: COMMISSION_FEE,
        token: 'TON',
        status: 'COMPLETED'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error('Ошибка сохранения транзакции: ' + JSON.stringify(errorData));
    }

    console.log('=== Отправка TON завершена успешно ===');
    return true;
  } catch (error) {
    console.error('=== Ошибка отправки TON ===', error);
    
    // Пытаемся сохранить информацию об ошибке
    try {
      await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-init-data': initData
        },
        body: JSON.stringify({
          type: 'WITHDRAWAL',
          amount: amount,
          address: toAddressStr,
          hash: Date.now().toString(),
          fee: COMMISSION_FEE,
          token: 'TON',
          status: 'FAILED',
          error: (error as Error).message
        })
      });
    } catch (e) {
      console.error('Не удалось сохранить информацию об ошибке:', e);
    }

    throw error;
  }
}

// Вспомогательная функция для расшифровки ключей
async function decryptKeyPair(walletData: WalletData, initData: string): Promise<KeyPair> {
  try {
    console.log('=== Начало расшифровки ключей ===');
    
    const encryptionKey = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('Ключ шифрования не найден в переменных окружения');
    }

    const encoder = new TextEncoder();
    
    // Разбираем зашифрованный ключ
    const [ivHex, authTagHex, encryptedDataHex] = walletData.encryptedKey.split(':');
    if (!ivHex || !authTagHex || !encryptedDataHex) {
      throw new Error('Некорректный формат зашифрованного ключа');
    }

    console.log('Компоненты шифрования:', {
      hasIV: !!ivHex,
      ivLength: ivHex.length,
      hasAuthTag: !!authTagHex,
      authTagLength: authTagHex.length,
      hasEncryptedData: !!encryptedDataHex,
      encryptedDataLength: encryptedDataHex.length
    });

    // Преобразуем компоненты из hex
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encryptedData = Buffer.from(encryptedDataHex, 'hex');

    // Создаем ключ расшифровки
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(encryptionKey),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    console.log('Ключ импортирован успешно');

    // Объединяем зашифрованные данные с тегом аутентификации
    const encryptedBuffer = Buffer.concat([encryptedData, authTag]);

    // Расшифровываем
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128
      },
      key,
      encryptedBuffer
    );

    console.log('Данные расшифрованы успешно');

    // Преобразуем расшифрованные данные в KeyPair
    const secretKey = Buffer.from(decrypted);
    const publicKey = Buffer.from(walletData.publicKey, 'hex');

    console.log('Ключи подготовлены:', {
      publicKeyLength: publicKey.length,
      secretKeyLength: secretKey.length
    });

    console.log('=== Расшифровка ключей завершена успешно ===');

    return {
      publicKey,
      secretKey
    };
  } catch (error) {
    console.error('=== Ошибка расшифровки ключей ===', error);
    throw error;
  }
}

// Функция отправки USDT
export async function sendUSDT(
  fromAddressStr: string,
  toAddressStr: string,
  amount: number,
  initData: string
): Promise<boolean> {
  try {
    console.log('=== Начало отправки USDT ===');
    console.log('Параметры:', {
      fromAddressStr,
      toAddressStr,
      amount,
      initDataLength: initData?.length
    });

    // Проверяем баланс TON для комиссии
    const { balance, usdtBalance } = await getBalance(fromAddressStr);
    const commissionInTon = 0.05;
    
    console.log('Проверка балансов:', {
      tonBalance: balance,
      usdtBalance,
      amount,
      commission: commissionInTon,
      sufficientTon: balance >= commissionInTon,
      sufficientUsdt: usdtBalance >= amount
    });
    
    if (balance < commissionInTon) {
      throw new Error(`Недостаточно TON для комиссии. Нужно: ${commissionInTon} TON`);
    }

    if (usdtBalance < amount) {
      throw new Error(`Недостаточно USDT. Доступно: ${usdtBalance} USDT`);
    }

    // Получаем данные кошелька
    const walletData = await localforage.getItem<WalletData>('wallet');
    if (!walletData) {
      throw new Error('Кошелёк не найден');
    }

    const keyPair = await decryptKeyPair(walletData, initData);
    const wallet = WalletContractV4.create({
      publicKey: keyPair.publicKey,
      workchain: 0
    });

    const contract = client.open(wallet);
    const seqno = await contract.getSeqno();
    
    // Формируем сообщение для отправки USDT
    const transferPayload = beginCell()
      .storeUint(0xf8a7ea5, 32) // transfer op
      .storeUint(0, 64) // query id
      .storeCoins(toNano(amount.toString())) // amount
      .storeAddress(Address.parse(toAddressStr)) // destination
      .storeAddress(Address.parse(fromAddressStr)) // response destination
      .storeBit(false) // no custom payload
      .endCell();

    // Отправляем транзакцию
    await contract.sendTransfer({
      secretKey: keyPair.secretKey,
      seqno,
      timeout: 60000,
      messages: [
        internal({
          to: Address.parse(USDT_CONTRACT_ADDRESS),
          value: toNano('0.05'), // комиссия
          bounce: true,
          body: transferPayload
        })
      ]
    });

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
        fee: commissionInTon,
        token: 'USDT'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Ошибка сохранения транзакции:', errorData);
    }

    console.log('=== Отправка USDT завершена успешно ===');
    return true;
  } catch (error) {
    console.error('=== Ошибка отправки USDT ===', error);
    throw error;
  }
} 