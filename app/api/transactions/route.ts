import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { verifyTelegramWebAppData } from '../../../utils/telegram';
import { TonClient, Address } from '@ton/ton';
import { Prisma } from '@prisma/client';
import type { Transaction, Wallet, User } from '@prisma/client';

// Определяем enum типы вручную, так как они не экспортируются напрямую
enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL'
}

enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

enum TokenType {
  TON = 'TON',
  USDT = 'USDT'
}

const client = new TonClient({
  endpoint: 'https://toncenter.com/api/v2/jsonRPC',
  apiKey: process.env.TONCENTER_API_KEY
});

interface TransactionRequest {
  type: TransactionType;
  amount: number;
  address: string;
  hash: string;
  fee: number;
  token: TokenType;
}

// Функция валидации данных транзакции
function validateTransactionData(data: TransactionRequest): { isValid: boolean; error?: string } {
  try {
    // Проверка типа транзакции
    if (!Object.values(TransactionType).includes(data.type)) {
      return { isValid: false, error: 'Invalid transaction type' };
    }

    // Проверка суммы
    if (typeof data.amount !== 'number' || data.amount <= 0) {
      return { isValid: false, error: 'Amount must be a positive number' };
    }

    // Проверка адреса
    if (!data.address.startsWith('UQ')) {
      return { isValid: false, error: 'Invalid wallet address format' };
    }

    // Проверка хэша
    if (!data.hash || typeof data.hash !== 'string' || data.hash.length < 10) {
      return { isValid: false, error: 'Invalid transaction hash' };
    }

    // Проверка комиссии
    if (typeof data.fee !== 'number' || data.fee < 0) {
      return { isValid: false, error: 'Fee must be a non-negative number' };
    }

    // Проверка типа токена
    if (!Object.values(TokenType).includes(data.token)) {
      return { isValid: false, error: 'Invalid token type' };
    }

    return { isValid: true };
  } catch (error) {
    return { isValid: false, error: 'Validation error: ' + (error as Error).message };
  }
}

// Функция создания транзакции
async function createTransaction(data: TransactionRequest, userId: number) {
  return await prisma.$transaction(async (tx) => {
    // Проверяем существование пользователя
    const user = await tx.user.findUnique({
      where: { id: userId },
      include: { wallets: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Находим кошелек пользователя
    const wallet = user.wallets[0];
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    // Проверяем баланс для исходящих транзакций
    if (data.type === TransactionType.WITHDRAWAL) {
      const currentBalance = data.token === TokenType.TON ? wallet.balance : wallet.usdtBalance;
      const totalAmount = data.amount + data.fee;
      
      if (currentBalance < totalAmount) {
        throw new Error(`Insufficient ${data.token} balance`);
      }
    }

    // Создаем транзакцию
    const transaction = await tx.transaction.create({
      data: {
        id: data.hash,
        hash: data.hash,
        type: data.type,
        amount: data.amount,
        address: data.address,
        status: TransactionStatus.PENDING,
        userId: userId,
        fee: data.fee,
        token: data.token
      }
    });

    // Обновляем баланс кошелька
    const balanceUpdate = data.type === TransactionType.DEPOSIT
      ? { increment: data.amount }
      : { decrement: data.amount + data.fee };

    if (data.token === TokenType.TON) {
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceUpdate }
      });
    } else {
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { usdtBalance: balanceUpdate }
      });
    }

    return transaction;
  });
}

export async function POST(request: Request) {
  try {
    const telegramInitData = request.headers.get('x-telegram-init-data');
    if (!telegramInitData) {
      return NextResponse.json({ error: 'No Telegram init data provided' }, { status: 401 });
    }

    const telegramUser = await verifyTelegramWebAppData(telegramInitData);
    if (!telegramUser) {
      return NextResponse.json({ error: 'Invalid Telegram init data' }, { status: 401 });
    }

    const body = await request.json() as TransactionRequest;
    
    // Валидация данных
    const validation = validateTransactionData(body);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Получаем пользователя
    const user = await prisma.user.findUnique({
      where: { telegramId: telegramUser.id.toString() }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Создаем транзакцию
    const transaction = await createTransaction(body, user.id);

    return NextResponse.json(transaction);
  } catch (error) {
    console.error('Error in transactions API:', error);
    
    // Обработка специфических ошибок Prisma
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json({ error: 'Transaction with this hash already exists' }, { status: 400 });
      }
    }

    return NextResponse.json(
      { error: 'Internal server error: ' + (error as Error).message },
      { status: 500 }
    );
  }
} 