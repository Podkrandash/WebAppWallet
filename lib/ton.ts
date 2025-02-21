import { TonClient, Address, fromNano, toNano, beginCell, internal, Cell } from '@ton/ton';
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

// Адреса контрактов Ston.fi
const STONFI_ROUTER_ADDRESS = 'EQB5Qd1H6t3T_4hJGQ0Mu_TBOGdVf2kU2yF6UhFAKGxRJBll';
const STONFI_POOL_ADDRESS = 'EQCcLAW537KnRg-aSPrnQJoyYBOj3Q-DtKx4Ni5JpVEhA9wE';
const USDT_CONTRACT_ADDRESS = 'EQBynBO23ywHy_CgarY9NK9FTz0yDsG82PtcbSTQgGoXwiuA';
const EARTH_CONTRACT_ADDRESS = '0:d5066866f08353bbdc00d275db444022657501c0a19ad158f590643c79f82b66';

// Комиссии
const NETWORK_FEE = 0.05;  // Комиссия сети TON
const DEX_FEE = 0.01;     // Комиссия Ston.fi
const SLIPPAGE = 0.01;    // Допустимое проскальзывание цены (1%)

// Информация о токене Earth
export const EARTH_TOKEN_INFO = {
  name: 'Earth',
  symbol: 'EARTH',
  decimals: 9,
  image: 'https://cache.tonapi.io/imgproxy/uqoLL2bjfmZGmPR1-imgNSK4WdkV6-IRpUhwlsgM98I/rs:fill:200:200:1/g:no/aHR0cHM6Ly9jZG4uYmx1bS5jb2Rlcy82MzM2M2JlOC01ZWVhLTQ0MTgtYTcxMi1lYTZhOTViZWFiYTMvZWJiNmE4MzItZmEyNS00Yzg4LWE0NTEtMDVjNmI0ODE1OWMy.webp'
};

interface WalletData {
  address: string;
  publicKey: string;
  secretKey: string;  // Теперь храним приватный ключ локально
}

export interface Transaction {
  id: string;
  hash: string;
  type: 'DEPOSIT' | 'WITHDRAWAL';
  amount: number;
  address: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  userId: string;
  fee: number;
  token: 'TON' | 'USDT' | 'EARTH';
  timestamp: Date;
  error?: string;
}

interface StonfiPoolData {
  tokenBalance: bigint;
  tonBalance: bigint;
  tokenWallet: string;
  lpSupply: bigint;
}

interface TransactionResult {
  success: boolean;
  error?: string;
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

// Функция для получения баланса Earth токенов
async function getEarthBalance(address: Address): Promise<number> {
  try {
    console.log('=== Начало получения баланса Earth ===');
    console.log('Адрес кошелька:', address.toString());
    console.log('Адрес контракта Earth:', EARTH_CONTRACT_ADDRESS);

    // Получаем данные о jetton кошелька
    const jettonWalletAddress = await retryWithDelay(async () => {
      try {
        const result = await client.runMethod(
          Address.parse(EARTH_CONTRACT_ADDRESS),
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
    console.log('Баланс Earth:', balanceValue);
    console.log('=== Получение баланса Earth завершено успешно ===');
    
    return balanceValue;
  } catch (error) {
    console.error('=== Критическая ошибка получения баланса Earth ===', error);
    return 0;
  }
}

// Обновляем функцию getBalance чтобы включить Earth
export async function getBalance(addressStr: string): Promise<{ 
  balance: number; 
  usdValue: string;
  tonPrice: number;
  usdtBalance: number;
  earthBalance: number;
}> {
  try {
    console.log('=== Начало получения баланса ===');
    console.log('Адрес:', addressStr);
    
    const address = Address.parse(addressStr);
    
    // Получаем баланс TON
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
    
    // Получаем баланс USDT
    console.log('Запрашиваем баланс USDT...');
    const usdtBalance = await getUSDTBalance(address);
    console.log('Баланс в USDT:', usdtBalance);

    // Получаем баланс Earth
    console.log('Запрашиваем баланс Earth...');
    const earthBalance = await getEarthBalance(address);
    console.log('Баланс в Earth:', earthBalance);
    
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
          usdtBalance,
          earthBalance
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
      usdtBalance,
      earthBalance
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
): Promise<TransactionResult> {
  try {
    console.log('=== Отправка TON ===', {
      from: fromAddressStr,
      to: toAddressStr,
      amount
    });

    // Нормализуем адрес получателя
    let toAddress;
    try {
      toAddress = Address.parse(toAddressStr);
    } catch (error) {
      console.error('=== Ошибка парсинга адреса получателя ===', error);
      return {
        success: false,
        error: 'Неверный адрес получателя'
      };
    }

    // Получаем данные кошелька из localStorage
    const walletData = localStorage.getItem('wallet');
    if (!walletData) {
      console.error('=== Ошибка: данные кошелька не найдены ===');
      return {
        success: false,
        error: 'Данные кошелька не найдены'
      };
    }

    // Создаем экземпляр кошелька
    const wallet = await createWallet(walletData);
    if (!wallet) {
      console.error('=== Ошибка: не удалось создать экземпляр кошелька ===');
      return {
        success: false,
        error: 'Не удалось создать экземпляр кошелька'
      };
    }

    // Проверяем баланс
    const balance = await getBalance(fromAddressStr);
    const networkFee = 0.05; // Комиссия сети в TON
    const totalRequired = amount + networkFee;

    if (balance.balance < totalRequired) {
      console.error('=== Ошибка: недостаточно средств ===', {
        balance: balance.balance,
        required: totalRequired
      });
      return {
        success: false,
        error: `Недостаточно средств. Необходимо: ${totalRequired} TON (${amount} TON + ${networkFee} TON комиссия), доступно: ${balance.balance} TON`
      };
    }

    // Отправляем транзакцию
    const seqno = await wallet.contract.getSeqno();
    await wallet.contract.sendTransfer({
      secretKey: wallet.keyPair.secretKey,
      toAddress: toAddress,
      amount: amount * 1e9,
      seqno: seqno,
      payload: '',
      sendMode: 3,
    });

    // Ждем подтверждения транзакции
    let attempts = 0;
    const maxAttempts = 10;
    while (attempts < maxAttempts) {
      await sleep(3000);
      const currentSeqno = await wallet.contract.getSeqno();
      if (currentSeqno > seqno) {
        break;
      }
      attempts++;
    }

    if (attempts === maxAttempts) {
      console.error('=== Ошибка: превышено время ожидания подтверждения транзакции ===');
      return {
        success: false,
        error: 'Превышено время ожидания подтверждения транзакции'
      };
    }

    // Сохраняем транзакцию в базу данных
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'WITHDRAWAL',
          amount,
          address: toAddressStr,
          fee: networkFee,
          token: 'TON',
          initData
        }),
      });

      if (!response.ok) {
        console.error('=== Ошибка сохранения транзакции ===');
        return {
          success: false,
          error: 'Ошибка сохранения транзакции'
        };
      }
    } catch (error) {
      console.error('=== Ошибка сохранения транзакции ===', error);
      return {
        success: false,
        error: 'Ошибка сохранения транзакции'
      };
    }

    return { success: true };
  } catch (error) {
    console.error('=== Ошибка отправки TON ===', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Произошла ошибка при отправке'
    };
  }
}

export async function sendUSDT(
  fromAddressStr: string,
  toAddressStr: string,
  amount: number,
  initData: string
): Promise<TransactionResult> {
  try {
    console.log('=== Отправка USDT ===', {
      from: fromAddressStr,
      to: toAddressStr,
      amount
    });

    // Нормализуем адрес получателя
    let toAddress;
    try {
      toAddress = Address.parse(toAddressStr);
    } catch (error) {
      console.error('=== Ошибка парсинга адреса получателя ===', error);
      return {
        success: false,
        error: 'Неверный адрес получателя'
      };
    }

    // Получаем данные кошелька из localStorage
    const walletData = localStorage.getItem('wallet');
    if (!walletData) {
      console.error('=== Ошибка: данные кошелька не найдены ===');
      return {
        success: false,
        error: 'Данные кошелька не найдены'
      };
    }

    // Создаем экземпляр кошелька
    const wallet = await createWallet(walletData);
    if (!wallet) {
      console.error('=== Ошибка: не удалось создать экземпляр кошелька ===');
      return {
        success: false,
        error: 'Не удалось создать экземпляр кошелька'
      };
    }

    // Проверяем балансы TON и USDT
    const balances = await getBalance(fromAddressStr);
    const networkFee = 0.05; // Комиссия сети в TON

    if (balances.balance < networkFee) {
      console.error('=== Ошибка: недостаточно TON для комиссии ===', {
        balance: balances.balance,
        required: networkFee
      });
      return {
        success: false,
        error: `Недостаточно TON для комиссии. Необходимо: ${networkFee} TON, доступно: ${balances.balance} TON`
      };
    }

    if (balances.usdtBalance < amount) {
      console.error('=== Ошибка: недостаточно USDT ===', {
        balance: balances.usdtBalance,
        required: amount
      });
      return {
        success: false,
        error: `Недостаточно USDT. Необходимо: ${amount} USDT, доступно: ${balances.usdtBalance} USDT`
      };
    }

    // Получаем адрес USDT кошелька отправителя
    const usdtWalletAddress = await getJettonWalletAddress(fromAddressStr, USDT_CONTRACT_ADDRESS);
    if (!usdtWalletAddress) {
      console.error('=== Ошибка: не удалось получить адрес USDT кошелька ===');
      return {
        success: false,
        error: 'Не удалось получить адрес USDT кошелька'
      };
    }

    // Создаем payload для отправки USDT
    const payload = beginCell()
      .storeUint(0xf8a7ea5, 32) // transfer op
      .storeUint(0, 64) // query id
      .storeCoins(amount * 1e9) // amount
      .storeAddress(toAddress) // destination
      .storeAddress(null) // response destination
      .storeUint(0, 1) // custom payload
      .storeCoins(1) // forward amount
      .storeUint(0, 1) // forward payload
      .endCell();

    // Отправляем транзакцию
    const seqno = await wallet.contract.getSeqno();
    await wallet.contract.sendTransfer({
      secretKey: wallet.keyPair.secretKey,
      toAddress: usdtWalletAddress,
      amount: networkFee * 1e9,
      seqno: seqno,
      payload: payload.toBoc().toString('base64'),
      sendMode: 3,
    });

    // Ждем подтверждения транзакции
    let attempts = 0;
    const maxAttempts = 10;
    while (attempts < maxAttempts) {
      await sleep(3000);
      const currentSeqno = await wallet.contract.getSeqno();
      if (currentSeqno > seqno) {
        break;
      }
      attempts++;
    }

    if (attempts === maxAttempts) {
      console.error('=== Ошибка: превышено время ожидания подтверждения транзакции ===');
      return {
        success: false,
        error: 'Превышено время ожидания подтверждения транзакции'
      };
    }

    // Сохраняем транзакцию в базу данных
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'WITHDRAWAL',
          amount,
          address: toAddressStr,
          fee: networkFee,
          token: 'USDT',
          initData
        }),
      });

      if (!response.ok) {
        console.error('=== Ошибка сохранения транзакции ===');
        return {
          success: false,
          error: 'Ошибка сохранения транзакции'
        };
      }
    } catch (error) {
      console.error('=== Ошибка сохранения транзакции ===', error);
      return {
        success: false,
        error: 'Ошибка сохранения транзакции'
      };
    }

    return { success: true };
  } catch (error) {
    console.error('=== Ошибка отправки USDT ===', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Произошла ошибка при отправке'
    };
  }
}

export async function sendEarth(
  fromAddressStr: string,
  toAddressStr: string,
  amount: number,
  initData: string
): Promise<TransactionResult> {
  try {
    console.log('=== Отправка EARTH ===', {
      from: fromAddressStr,
      to: toAddressStr,
      amount
    });

    // Нормализуем адрес получателя
    let toAddress;
    try {
      toAddress = Address.parse(toAddressStr);
    } catch (error) {
      console.error('=== Ошибка парсинга адреса получателя ===', error);
      return {
        success: false,
        error: 'Неверный адрес получателя'
      };
    }

    // Получаем данные кошелька из localStorage
    const walletData = localStorage.getItem('wallet');
    if (!walletData) {
      console.error('=== Ошибка: данные кошелька не найдены ===');
      return {
        success: false,
        error: 'Данные кошелька не найдены'
      };
    }

    // Создаем экземпляр кошелька
    const wallet = await createWallet(walletData);
    if (!wallet) {
      console.error('=== Ошибка: не удалось создать экземпляр кошелька ===');
      return {
        success: false,
        error: 'Не удалось создать экземпляр кошелька'
      };
    }

    // Проверяем балансы TON и EARTH
    const balances = await getBalance(fromAddressStr);
    const networkFee = 0.05; // Комиссия сети в TON

    if (balances.balance < networkFee) {
      console.error('=== Ошибка: недостаточно TON для комиссии ===', {
        balance: balances.balance,
        required: networkFee
      });
      return {
        success: false,
        error: `Недостаточно TON для комиссии. Необходимо: ${networkFee} TON, доступно: ${balances.balance} TON`
      };
    }

    if (balances.earthBalance < amount) {
      console.error('=== Ошибка: недостаточно EARTH ===', {
        balance: balances.earthBalance,
        required: amount
      });
      return {
        success: false,
        error: `Недостаточно EARTH. Необходимо: ${amount} EARTH, доступно: ${balances.earthBalance} EARTH`
      };
    }

    // Получаем адрес EARTH кошелька отправителя
    const earthWalletAddress = await getJettonWalletAddress(fromAddressStr, EARTH_CONTRACT_ADDRESS);
    if (!earthWalletAddress) {
      console.error('=== Ошибка: не удалось получить адрес EARTH кошелька ===');
      return {
        success: false,
        error: 'Не удалось получить адрес EARTH кошелька'
      };
    }

    // Создаем payload для отправки EARTH
    const payload = beginCell()
      .storeUint(0xf8a7ea5, 32) // transfer op
      .storeUint(0, 64) // query id
      .storeCoins(amount * 1e9) // amount
      .storeAddress(toAddress) // destination
      .storeAddress(null) // response destination
      .storeUint(0, 1) // custom payload
      .storeCoins(1) // forward amount
      .storeUint(0, 1) // forward payload
      .endCell();

    // Отправляем транзакцию
    const seqno = await wallet.contract.getSeqno();
    await wallet.contract.sendTransfer({
      secretKey: wallet.keyPair.secretKey,
      toAddress: earthWalletAddress,
      amount: networkFee * 1e9,
      seqno: seqno,
      payload: payload.toBoc().toString('base64'),
      sendMode: 3,
    });

    // Ждем подтверждения транзакции
    let attempts = 0;
    const maxAttempts = 10;
    while (attempts < maxAttempts) {
      await sleep(3000);
      const currentSeqno = await wallet.contract.getSeqno();
      if (currentSeqno > seqno) {
        break;
      }
      attempts++;
    }

    if (attempts === maxAttempts) {
      console.error('=== Ошибка: превышено время ожидания подтверждения транзакции ===');
      return {
        success: false,
        error: 'Превышено время ожидания подтверждения транзакции'
      };
    }

    // Сохраняем транзакцию в базу данных
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'WITHDRAWAL',
          amount,
          address: toAddressStr,
          fee: networkFee,
          token: 'EARTH',
          initData
        }),
      });

      if (!response.ok) {
        console.error('=== Ошибка сохранения транзакции ===');
        return {
          success: false,
          error: 'Ошибка сохранения транзакции'
        };
      }
    } catch (error) {
      console.error('=== Ошибка сохранения транзакции ===', error);
      return {
        success: false,
        error: 'Ошибка сохранения транзакции'
      };
    }

    return { success: true };
  } catch (error) {
    console.error('=== Ошибка отправки EARTH ===', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Произошла ошибка при отправке'
    };
  }
}

// Получение данных пула Ston.fi
async function getStonfiPoolData(): Promise<StonfiPoolData> {
  try {
    console.log('=== Получение данных пула Ston.fi ===');
    
    const result = await client.runMethod(
      Address.parse(STONFI_POOL_ADDRESS),
      'get_pool_data',
      []
    );

    if (!result || !Array.isArray(result) || result.length < 4) {
      throw new Error('Некорректные данные пула');
    }

    const poolData: StonfiPoolData = {
      tokenBalance: BigInt(result[0].toString()),
      tonBalance: BigInt(result[1].toString()),
      tokenWallet: result[2].toString(),
      lpSupply: BigInt(result[3].toString())
    };

    console.log('Данные пула:', {
      tokenBalance: fromNano(poolData.tokenBalance.toString()),
      tonBalance: fromNano(poolData.tonBalance.toString()),
      tokenWallet: poolData.tokenWallet,
      lpSupply: fromNano(poolData.lpSupply.toString())
    });

    return poolData;
  } catch (error) {
    console.error('Ошибка получения данных пула:', error);
    throw error;
  }
}

// Расчет суммы обмена с учетом проскальзывания
function calculateSwapAmount(
  amount: number,
  poolData: StonfiPoolData,
  isTonToToken: boolean
): { minReceived: bigint; expectedReceived: bigint } {
  const amountN = BigInt(toNano(amount.toString()));
  
  if (isTonToToken) {
    // TON -> USDT
    const expectedReceived = (amountN * poolData.tokenBalance) / poolData.tonBalance;
    const minReceived = expectedReceived - (expectedReceived * BigInt(Math.floor(SLIPPAGE * 100))) / BigInt(100);
    return { minReceived, expectedReceived };
  } else {
    // USDT -> TON
    const expectedReceived = (amountN * poolData.tonBalance) / poolData.tokenBalance;
    const minReceived = expectedReceived - (expectedReceived * BigInt(Math.floor(SLIPPAGE * 100))) / BigInt(100);
    return { minReceived, expectedReceived };
  }
}

// Формирование сообщения для обмена
function buildSwapPayload(
  amount: bigint,
  minReceived: bigint,
  recipient: Address,
  isTonToToken: boolean
): Cell {
  return beginCell()
    .storeUint(isTonToToken ? 0x25938561 : 0x3c3abc33, 32) // swap_ton или swap_token
    .storeUint(0, 64) // query_id
    .storeCoins(amount) // amount
    .storeCoins(minReceived) // min_received
    .storeAddress(recipient) // recipient
    .storeRef(
      beginCell()
        .storeBuffer(Buffer.from('Swap via EarthWallet'))
        .endCell()
    )
    .endCell();
}

export async function swapCrypto(
  fromAddressStr: string,
  amount: number,
  isTonToToken: boolean,
  initData: string
): Promise<boolean> {
  try {
    console.log('=== Начало обмена криптовалюты ===');
    console.log('Параметры:', {
      fromAddressStr,
      amount,
      isTonToToken,
      initDataLength: initData?.length
    });

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

    // Проверяем балансы
    const { balance, usdtBalance } = await retryWithDelay(() => getBalance(fromAddressStr));
    
    // Получаем данные пула
    const poolData = await getStonfiPoolData();
    
    // Рассчитываем сумму обмена
    const { minReceived, expectedReceived } = calculateSwapAmount(amount, poolData, isTonToToken);
    
    console.log('Расчет обмена:', {
      amount,
      expectedReceived: fromNano(expectedReceived.toString()),
      minReceived: fromNano(minReceived.toString()),
      isTonToToken
    });

    // Проверяем достаточность средств
    if (isTonToToken) {
      const totalAmount = amount + NETWORK_FEE + DEX_FEE;
      if (balance < totalAmount) {
        throw new Error(`Недостаточно TON. Нужно: ${totalAmount} TON (включая комиссии: сеть ${NETWORK_FEE} TON, DEX ${DEX_FEE} TON)`);
      }
    } else {
      if (usdtBalance < amount) {
        throw new Error(`Недостаточно USDT. Доступно: ${usdtBalance} USDT`);
      }
      if (balance < NETWORK_FEE + DEX_FEE) {
        throw new Error(`Недостаточно TON для комиссии. Нужно: ${NETWORK_FEE + DEX_FEE} TON`);
      }
    }

    // Подготавливаем транзакцию
    const contract = client.open(wallet);
    const seqno = await contract.getSeqno();
    
    // Формируем сообщение для обмена
    const swapPayload = buildSwapPayload(
      BigInt(toNano(amount.toString())),
      minReceived,
      wallet.address,
      isTonToToken
    );

    // Отправляем транзакцию
    await contract.sendTransfer({
      secretKey: Buffer.from(walletData.secretKey, 'hex'),
      seqno: seqno,
      messages: [
        internal({
          to: Address.parse(STONFI_POOL_ADDRESS),
          value: toNano(isTonToToken ? amount.toString() : (NETWORK_FEE + DEX_FEE).toString()),
          bounce: true,
          body: swapPayload
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
              type: 'EXCHANGE',
              amount: amount,
              address: STONFI_POOL_ADDRESS,
              hash: seqno.toString(),
              fee: NETWORK_FEE + DEX_FEE,
              token: isTonToToken ? 'TON_TO_USDT' : 'USDT_TO_TON',
              status: 'COMPLETED'
            })
          });

          if (!response.ok) {
            console.warn('Транзакция прошла, но не удалось сохранить в базу:', await response.json());
          }

          console.log('=== Обмен криптовалюты завершен успешно ===');
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
    console.error('=== Ошибка обмена криптовалюты ===', {
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
          type: 'EXCHANGE',
          amount: amount,
          address: STONFI_POOL_ADDRESS,
          hash: Date.now().toString(),
          fee: NETWORK_FEE + DEX_FEE,
          token: isTonToToken ? 'TON_TO_USDT' : 'USDT_TO_TON',
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

async function createWallet(walletData: string): Promise<{
  contract: any;
  keyPair: {
    publicKey: Buffer;
    secretKey: Buffer;
  };
} | null> {
  try {
    const data = JSON.parse(walletData);
    const keyPair = {
      publicKey: Buffer.from(data.publicKey, 'hex'),
      secretKey: Buffer.from(data.secretKey, 'hex')
    };
    const wallet = WalletContractV4.create({
      publicKey: keyPair.publicKey,
      workchain: 0
    });
    const contract = client.open(wallet);
    return { contract, keyPair };
  } catch (error) {
    console.error('Ошибка создания кошелька:', error);
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getJettonWalletAddress(ownerAddress: string, jettonMasterAddress: string): Promise<Address | null> {
  try {
    const owner = Address.parse(ownerAddress);
    const master = Address.parse(jettonMasterAddress);
    
    const result = await client.runMethod(
      master,
      'get_wallet_address',
      [{ type: 'slice', cell: beginCell().storeAddress(owner).endCell() }]
    );
    
    if (!result) return null;
    return result.stack.readAddress();
  } catch (error) {
    console.error('Ошибка получения адреса jetton кошелька:', error);
    return null;
  }
} 