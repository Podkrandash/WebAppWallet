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
  secretKey: string;  // Теперь храним приватный ключ локально
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
    // Проверяем, есть ли уже кошелек в локальном хранилище
    const existingWallet = await localforage.getItem<WalletData>('wallet');
    
    // Если есть кошелек с secretKey, значит он уже в новом формате
    if (existingWallet && existingWallet.secretKey) {
      return existingWallet;
    }

    // Пробуем получить существующий кошелек из базы
    const response = await fetch('/api/wallet', {
      headers: {
        'x-telegram-init-data': initData
      }
    });

    if (response.ok) {
      const walletFromDb = await response.json();
      
      // Если нашли кошелек, создаем новую пару ключей
      if (walletFromDb) {
        console.log('=== Миграция существующего кошелька ===');
        
        // Генерируем новую пару ключей
        const seed = await getSecureRandomBytes(32);
        const keyPair = keyPairFromSeed(seed);

        const walletData = {
          address: walletFromDb.address,
          publicKey: Buffer.from(keyPair.publicKey).toString('hex'),
          secretKey: Buffer.from(keyPair.secretKey).toString('hex')
        };

        // Обновляем публичный ключ в базе
        const updateResponse = await fetch('/api/wallet', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-telegram-init-data': initData
          },
          body: JSON.stringify({
            address: walletData.address,
            publicKey: walletData.publicKey
          })
        });

        if (!updateResponse.ok) {
          throw new Error('Ошибка обновления кошелька');
        }

        // Сохраняем новые данные локально
        await localforage.setItem('wallet', walletData);
        console.log('=== Миграция кошелька завершена успешно ===');
        
        return walletData;
      }
    }

    // Если кошелька нет ни локально, ни в базе - создаем новый
    console.log('=== Создание нового кошелька ===');
    const seed = await getSecureRandomBytes(32);
    const keyPair = keyPairFromSeed(seed);

    const wallet = WalletContractV4.create({
      publicKey: keyPair.publicKey,
      workchain: 0
    });

    const walletData = {
      address: wallet.address.toString(),
      publicKey: Buffer.from(keyPair.publicKey).toString('hex'),
      secretKey: Buffer.from(keyPair.secretKey).toString('hex')
    };

    // Сохраняем в базу только публичный ключ и адрес
    const createResponse = await fetch('/api/wallet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-init-data': initData
      },
      body: JSON.stringify({
        address: walletData.address,
        publicKey: walletData.publicKey
      })
    });

    if (!createResponse.ok) {
      const error = await createResponse.json();
      throw new Error(error.error || 'Ошибка создания кошелька');
    }

    // Сохраняем полные данные локально
    await localforage.setItem('wallet', walletData);
    console.log('=== Создание кошелька завершено успешно ===');
    
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
    console.log('=== Начало получения баланса ===');
    console.log('Адрес:', addressStr);
    
    const address = Address.parse(addressStr);
    
    // Получаем баланс TON с подробным логированием
    console.log('Запрашиваем баланс TON...');
    const balance = await retryWithDelay(async () => {
      try {
        const result = await client.getBalance(address);
        console.log('Получен ответ от TON Center:', result);
        return result;
      } catch (error) {
        console.error('Ошибка при запросе баланса TON:', error);
        throw error;
      }
    });
    
    const balanceInTon = Number(fromNano(balance));
    console.log('Баланс в TON:', balanceInTon);
    
    // Получаем баланс USDT с подробным логированием
    console.log('Запрашиваем баланс USDT...');
    const usdtBalance = await getUSDTBalance(address);
    console.log('Баланс в USDT:', usdtBalance);
    
    // Получаем курс TON
    console.log('Запрашиваем курс TON...');
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
        
        const balanceInRub = balanceInTon * tonPrice;
        console.log('Баланс в рублях:', balanceInRub);
        
        console.log('=== Получение баланса завершено успешно ===');
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
    
    console.log('=== Получение баланса завершено с запасным курсом ===');
    return {
      balance: balanceInTon,
      usdValue: '0.00',
      tonPrice: 0,
      usdtBalance
    };
  } catch (error) {
    console.error('=== Критическая ошибка получения баланса ===', error);
    throw error;
  }
}

// Функция для получения баланса USDT
async function getUSDTBalance(address: Address): Promise<number> {
  try {
    console.log('=== Начало получения баланса USDT ===');
    console.log('Адрес кошелька:', address.toString());
    console.log('Адрес контракта USDT:', USDT_CONTRACT_ADDRESS);

    // Получаем данные о jetton кошелька
    const jettonWalletAddress = await retryWithDelay(async () => {
      try {
        const result = await client.runMethod(
          Address.parse(USDT_CONTRACT_ADDRESS),
          'get_wallet_address',
          [{
            type: 'slice',
            cell: beginCell().storeAddress(address).endCell()
          }]
        );
        console.log('Получен адрес jetton кошелька:', result);
        return result;
      } catch (error) {
        console.error('Ошибка получения адреса jetton кошелька:', error);
        throw error;
      }
    });

    if (!jettonWalletAddress) {
      console.log('Jetton кошелек не найден, возвращаем 0');
      return 0;
    }

    // Получаем баланс jetton кошелька
    const balance = await retryWithDelay(async () => {
      try {
        const result = await client.runMethod(
          Address.parse(jettonWalletAddress.toString()),
          'get_wallet_data',
          []
        );
        console.log('Получены данные jetton кошелька:', result);
        return result;
      } catch (error) {
        console.error('Ошибка получения данных jetton кошелька:', error);
        throw error;
      }
    });

    if (!balance) {
      console.log('Баланс не получен, возвращаем 0');
      return 0;
    }

    const balanceValue = Number(fromNano(balance.toString()));
    console.log('Баланс USDT:', balanceValue);
    console.log('=== Получение баланса USDT завершено успешно ===');
    
    return balanceValue;
  } catch (error) {
    console.error('=== Критическая ошибка получения баланса USDT ===', error);
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

// Функция для задержки
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Функция для повторных попыток с экспоненциальной задержкой
async function retryWithDelay<T>(
  fn: () => Promise<T>,
  retries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: any;
  let attempt = 1;

  while (retries >= 0) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      console.error(`Попытка ${attempt}, ошибка:`, {
        status: error.response?.status || error.status,
        message: error.message,
        response: error.response?.data || error.response,
        stack: error.stack
      });

      // Повторяем попытку только для ошибок 429 и 500
      if (retries > 0 && (
        error.response?.status === 429 || 
        error.status === 429 ||
        error.response?.status === 500 ||
        error.status === 500
      )) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`Ожидаем ${delay}мс перед повторной попыткой ${attempt + 1}...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        retries--;
        attempt++;
        continue;
      }

      throw error;
    }
  }

  // Если все попытки исчерпаны
  console.error('Все попытки исчерпаны. Последняя ошибка:', lastError);
  throw lastError;
}

export async function sendTON(
  fromAddressStr: string,
  toAddressStr: string,
  amount: number,
  initData: string
): Promise<boolean> {
  try {
    console.log('=== Начало отправки TON ===');
    console.log('Параметры:', { fromAddressStr, toAddressStr, amount });

    // Проверяем формат адреса
    if (!toAddressStr.startsWith('UQ')) {
      throw new Error('Неверный формат адреса получателя. Адрес должен начинаться с UQ');
    }

    // Получаем данные кошелька
    const walletData = await localforage.getItem<WalletData>('wallet');
    if (!walletData) {
      throw new Error('Кошелёк не найден');
    }

    // Создаем кошелек
    const wallet = WalletContractV4.create({
      publicKey: Buffer.from(walletData.publicKey, 'hex'),
      workchain: 0
    });

    // Проверяем баланс
    const balance = await client.getBalance(wallet.address);
    const balanceInTon = Number(fromNano(balance));
    const totalAmount = amount + COMMISSION_FEE;

    console.log('Проверка баланса:', {
      balance: balanceInTon,
      required: totalAmount,
      sufficient: balanceInTon >= totalAmount
    });

    if (balanceInTon < totalAmount) {
      throw new Error(`Недостаточно средств. Нужно: ${totalAmount} TON (включая комиссию ${COMMISSION_FEE} TON)`);
    }

    // Подготавливаем транзакцию
    const contract = client.open(wallet);
    const seqno = await contract.getSeqno();

    console.log('Отправка транзакции...');
    
    // Отправляем транзакцию
    await contract.sendTransfer({
      secretKey: Buffer.from(walletData.secretKey, 'hex'),
      seqno: seqno,
      messages: [
        internal({
          to: Address.parse(toAddressStr),
          value: toNano(amount.toString()),
          bounce: false
        })
      ]
    });

    // Ждем подтверждения транзакции
    let currentSeqno = seqno;
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      console.log(`Проверка подтверждения транзакции (попытка ${attempts + 1}/${maxAttempts})...`);
      await delay(3000);

      try {
        const newSeqno = await contract.getSeqno();
        if (newSeqno !== currentSeqno) {
          console.log('Транзакция подтверждена');
          
          // Сохраняем в базу данных
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
            console.warn('Транзакция прошла, но не удалось сохранить в базу:', await response.json());
          }

          // Отправляем комиссию, если указан адрес
          if (COMMISSION_ADDRESS) {
            try {
              const commissionSeqno = await contract.getSeqno();
              await contract.sendTransfer({
                secretKey: Buffer.from(walletData.secretKey, 'hex'),
                seqno: commissionSeqno,
                messages: [
                  internal({
                    to: Address.parse(COMMISSION_ADDRESS),
                    value: toNano(COMMISSION_FEE.toString()),
                    bounce: false
                  })
                ]
              });
              console.log('Комиссия отправлена');
            } catch (error) {
              console.warn('Не удалось отправить комиссию:', error);
            }
          }

          console.log('=== Отправка TON завершена успешно ===');
          return true;
        }
        currentSeqno = newSeqno;
      } catch (error) {
        console.warn(`Ошибка при проверке подтверждения (попытка ${attempts + 1}):`, error);
      }
      attempts++;
    }

    throw new Error('Не удалось получить подтверждение транзакции');
  } catch (error: any) {
    console.error('=== Ошибка отправки TON ===', {
      message: error.message,
      stack: error.stack
    });

    // Сохраняем информацию об ошибке
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
          error: error.message
        })
      });
    } catch (e) {
      console.error('Не удалось сохранить информацию об ошибке:', e);
    }

    throw error;
  }
}

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
    const { balance, usdtBalance } = await retryWithDelay(() => getBalance(fromAddressStr));
    
    console.log('Проверка балансов:', {
      tonBalance: balance,
      usdtBalance,
      amount,
      commission: COMMISSION_FEE,
      sufficientTon: balance >= COMMISSION_FEE,
      sufficientUsdt: usdtBalance >= amount
    });
    
    if (balance < COMMISSION_FEE) {
      throw new Error(`Недостаточно TON для комиссии. Нужно: ${COMMISSION_FEE} TON`);
    }

    if (usdtBalance < amount) {
      throw new Error(`Недостаточно USDT. Доступно: ${usdtBalance} USDT`);
    }

    // Получаем данные кошелька
    const walletData = await localforage.getItem<WalletData>('wallet');
    if (!walletData) {
      throw new Error('Кошелёк не найден');
    }

    // Создаем и инициализируем кошелек
    const wallet = WalletContractV4.create({
      publicKey: Buffer.from(walletData.publicKey, 'hex'),
      workchain: 0
    });

    const contract = client.open(wallet);
    const seqno = await retryWithDelay(() => contract.getSeqno());
    
    // Формируем сообщение для отправки USDT
    const transferPayload = beginCell()
      .storeUint(0xf8a7ea5, 32) // transfer op
      .storeUint(0, 64) // query id
      .storeCoins(toNano(amount.toString())) // amount
      .storeAddress(Address.parse(toAddressStr)) // destination
      .storeAddress(Address.parse(fromAddressStr)) // response destination
      .storeBit(false) // no custom payload
      .endCell();

    // Отправляем транзакцию с retry
    await retryWithDelay(() => contract.sendTransfer({
      secretKey: Buffer.from(walletData.secretKey, 'hex'),
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
    }));

    // Сохраняем в базу данных
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
        token: 'USDT',
        status: 'COMPLETED'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Ошибка сохранения транзакции:', errorData);
      throw new Error('Ошибка сохранения транзакции: ' + JSON.stringify(errorData));
    }

    console.log('=== Отправка USDT завершена успешно ===');
    return true;
  } catch (error) {
    console.error('=== Ошибка отправки USDT ===', error);
    
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
          token: 'USDT',
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