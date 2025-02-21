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
const STONFI_POOL_TON_USDT = 'EQCcLAW537KnRg-aSPrnQJoyYBOj3Q-DtKx4Ni5JpVEhA9wE';
const STONFI_POOL_TON_EARTH = 'EQDQoc5M3Bh8eWFephi9bClhevelbZZvWhkqdo80XuY_0qXv';
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

async function sendToken(
  fromAddressStr: string,
  toAddressStr: string,
  amount: number,
  tokenType: 'TON' | 'USDT' | 'EARTH',
  initData: string
): Promise<TransactionResult> {
  try {
    console.log(`=== Отправка ${tokenType} ===`, { from: fromAddressStr, to: toAddressStr, amount });

    // Получаем данные кошелька
    const walletData = await localforage.getItem<WalletData>('wallet');
    if (!walletData) throw new Error('Кошелёк не найден');

    // Нормализуем адрес получателя
    const toAddress = Address.parse(toAddressStr);
    
    // Создаем кошелек
    const wallet = WalletContractV4.create({
      publicKey: Buffer.from(walletData.publicKey, 'hex'),
      workchain: 0
    });
    const contract = client.open(wallet);

    // Проверяем балансы
    const balances = await getBalance(fromAddressStr);
    const networkFee = 0.05;

    // Проверяем достаточность TON для комиссии
    if (balances.balance < networkFee) {
      throw new Error(`Недостаточно TON для комиссии. Нужно: ${networkFee} TON`);
    }

    if (tokenType === 'TON') {
      // Проверяем баланс TON
      if (balances.balance < amount + networkFee) {
        throw new Error(`Недостаточно TON. Нужно: ${amount + networkFee} TON`);
      }

      // Отправляем TON
      const seqno = await contract.getSeqno();
      await contract.sendTransfer({
        secretKey: Buffer.from(walletData.secretKey, 'hex'),
        seqno: seqno,
        messages: [
          internal({
            to: toAddress,
            value: toNano(amount.toString()),
            bounce: true,
            body: ''
          })
        ],
        sendMode: 1 + 2 // ADD_FEE_TO_VALUE + IGNORE_ERRORS
      });

      await waitForTransaction(contract, seqno);
    } else {
      // Для USDT и EARTH
      const tokenAddress = tokenType === 'USDT' ? USDT_CONTRACT_ADDRESS : EARTH_CONTRACT_ADDRESS;
      const tokenBalance = tokenType === 'USDT' ? balances.usdtBalance : balances.earthBalance;

      // Проверяем баланс токена
      if (tokenBalance < amount) {
        throw new Error(`Недостаточно ${tokenType}. Нужно: ${amount} ${tokenType}`);
      }

      // Получаем адрес токен-кошелька
      const jettonWallet = await getJettonWalletAddress(fromAddressStr, tokenAddress);
      if (!jettonWallet) throw new Error(`Не удалось получить адрес ${tokenType} кошелька`);

      // Создаем payload для отправки токена
      const payload = beginCell()
        .storeUint(0xf8a7ea5, 32)
        .storeUint(0, 64)
        .storeCoins(toNano(amount.toString()))
        .storeAddress(toAddress)
        .storeAddress(null)
        .storeUint(0, 1)
        .storeCoins(1)
        .storeUint(0, 1)
        .endCell();

      // Отправляем транзакцию
      const seqno = await contract.getSeqno();
      await contract.sendTransfer({
        secretKey: Buffer.from(walletData.secretKey, 'hex'),
        seqno: seqno,
        messages: [
          internal({
            to: jettonWallet,
            value: toNano(networkFee.toString()),
            bounce: true,
            body: payload.toBoc().toString('base64')
          })
        ],
        sendMode: 1 + 2 // ADD_FEE_TO_VALUE + IGNORE_ERRORS
      });

      await waitForTransaction(contract, seqno);
    }

    // Сохраняем транзакцию
    await saveTransaction({
      type: 'WITHDRAWAL',
      amount,
      address: toAddressStr,
      fee: networkFee,
      token: tokenType,
      initData
    });

    return { success: true };
  } catch (error) {
    console.error(`Ошибка отправки ${tokenType}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Произошла ошибка при отправке'
    };
  }
}

export const sendTON = (from: string, to: string, amount: number, initData: string) => 
  sendToken(from, to, amount, 'TON', initData);

export const sendUSDT = (from: string, to: string, amount: number, initData: string) => 
  sendToken(from, to, amount, 'USDT', initData);

export const sendEarth = (from: string, to: string, amount: number, initData: string) => 
  sendToken(from, to, amount, 'EARTH', initData);

async function saveTransaction(data: {
  type: 'WITHDRAWAL';
  amount: number;
  address: string;
  fee: number;
  token: string;
  initData: string;
}): Promise<void> {
  try {
    await fetch('/api/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-init-data': data.initData
      },
      body: JSON.stringify({
        type: data.type,
        amount: data.amount,
        address: data.address,
        fee: data.fee,
        token: data.token,
        status: 'COMPLETED'
      })
    });
  } catch (error) {
    console.warn('Не удалось сохранить транзакцию:', error);
  }
}

// Получение данных пула Ston.fi
async function getStonfiPoolData(poolAddress: string): Promise<StonfiPoolData> {
  try {
    console.log('=== Получение данных пула Ston.fi ===');
    
    const result = await client.runMethod(
      Address.parse(poolAddress),
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
  fromToken: string,
  toToken: string
): Cell {
  const isTonToToken = fromToken === 'TON';
  return beginCell()
    .storeUint(isTonToToken ? 0x25938561 : 0x3c3abc33, 32)
    .storeUint(0, 64)
    .storeCoins(amount)
    .storeCoins(minReceived)
    .storeAddress(recipient)
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
  fromToken: 'TON' | 'USDT' | 'EARTH',
  toToken: 'TON' | 'USDT' | 'EARTH',
  initData: string
): Promise<boolean> {
  try {
    console.log('=== Начало обмена криптовалюты ===', { fromToken, toToken, amount });

    // Получаем данные кошелька
    const walletData = await localforage.getItem<WalletData>('wallet');
    if (!walletData) throw new Error('Кошелёк не найден');

    // Создаем кошелек
    const wallet = WalletContractV4.create({
      publicKey: Buffer.from(walletData.publicKey, 'hex'),
      workchain: 0
    });

    // Определяем пул для свапа
    const poolAddress = getPoolAddress(fromToken, toToken);
    if (!poolAddress) throw new Error('Неподдерживаемая пара токенов');

    // Получаем данные пула
    const poolData = await getStonfiPoolData(poolAddress);
    
    // Проверяем балансы
    const balances = await getBalance(fromAddressStr);
    const fromBalance = getTokenBalance(balances, fromToken);
    
    // Проверяем достаточность средств
    if (fromToken === 'TON') {
      const totalAmount = amount + NETWORK_FEE + DEX_FEE;
      if (balances.balance < totalAmount) {
        throw new Error(`Недостаточно TON. Нужно: ${totalAmount} TON`);
      }
    } else {
      if (fromBalance < amount) {
        throw new Error(`Недостаточно ${fromToken}. Доступно: ${fromBalance}`);
      }
      if (balances.balance < NETWORK_FEE + DEX_FEE) {
        throw new Error(`Недостаточно TON для комиссии`);
      }
    }

    // Рассчитываем сумму обмена
    const { minReceived } = calculateSwapAmount(amount, poolData, fromToken === 'TON');

    // Подготавливаем транзакцию
    const contract = client.open(wallet);
    const seqno = await contract.getSeqno();
    
    // Формируем сообщение для обмена
    const swapPayload = buildSwapPayload(
      BigInt(toNano(amount.toString())),
      minReceived,
      wallet.address,
      fromToken,
      toToken
    );

    // Отправляем транзакцию
    await contract.sendTransfer({
      secretKey: Buffer.from(walletData.secretKey, 'hex'),
      seqno: seqno,
      messages: [
        internal({
          to: Address.parse(poolAddress),
          value: toNano(fromToken === 'TON' ? amount.toString() : (NETWORK_FEE + DEX_FEE).toString()),
          bounce: true,
          body: swapPayload
        })
      ]
    });

    // Ждем подтверждения
    await waitForTransaction(contract, seqno);

    // Сохраняем в базу
    await saveSwapTransaction({
      amount,
      fromToken,
      toToken,
      poolAddress,
      seqno: seqno.toString(),
      initData
    });

    return true;
  } catch (error) {
    console.error('Ошибка свапа:', error);
    throw error;
  }
}

function getPoolAddress(fromToken: string, toToken: string): string {
  if ((fromToken === 'TON' && toToken === 'USDT') || 
      (fromToken === 'USDT' && toToken === 'TON')) {
    return STONFI_POOL_TON_USDT;
  }
  if ((fromToken === 'TON' && toToken === 'EARTH') || 
      (fromToken === 'EARTH' && toToken === 'TON')) {
    return STONFI_POOL_TON_EARTH;
  }
  return '';
}

function getTokenBalance(balances: any, token: string): number {
  switch (token) {
    case 'TON': return balances.balance;
    case 'USDT': return balances.usdtBalance;
    case 'EARTH': return balances.earthBalance;
    default: return 0;
  }
}

async function waitForTransaction(contract: any, seqno: number): Promise<void> {
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    await delay(3000);
    const currentSeqno = await contract.getSeqno();
    if (currentSeqno > seqno) return;
    attempts++;
  }
  
  throw new Error('Превышено время ожидания подтверждения транзакции');
}

async function saveSwapTransaction(data: {
  amount: number;
  fromToken: string;
  toToken: string;
  poolAddress: string;
  seqno: string;
  initData: string;
}): Promise<void> {
  try {
    await fetch('/api/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-init-data': data.initData
      },
      body: JSON.stringify({
        type: 'EXCHANGE',
        amount: data.amount,
        address: data.poolAddress,
        hash: data.seqno,
        fee: NETWORK_FEE + DEX_FEE,
        token: `${data.fromToken}_TO_${data.toToken}`,
        status: 'COMPLETED'
      })
    });
  } catch (error) {
    console.warn('Не удалось сохранить транзакцию:', error);
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