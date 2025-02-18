import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { verifyTelegramWebAppData } from '../../../utils/telegram';
import { TonClient, Address } from '@ton/ton';
import { Prisma } from '@prisma/client';

const client = new TonClient({
  endpoint: 'https://toncenter.com/api/v2/jsonRPC',
  apiKey: process.env.TONCENTER_API_KEY
});

export async function POST(request: Request) {
  try {
    const telegramInitData = request.headers.get('x-telegram-init-data');
    if (!telegramInitData) {
      console.error('No Telegram init data provided');
      return NextResponse.json({ error: 'No Telegram init data provided' }, { status: 401 });
    }

    console.log('Проверка данных Telegram...');
    const telegramUser = await verifyTelegramWebAppData(telegramInitData);
    if (!telegramUser) {
      console.error('Invalid Telegram init data');
      return NextResponse.json({ error: 'Invalid Telegram init data' }, { status: 401 });
    }

    const body = await request.json();
    const { type, amount, address, hash, fee } = body;

    console.log('Данные транзакции:', { type, amount, address, hash, fee });

    // Проверяем тип операции
    if (!['deposit', 'withdrawal'].includes(type)) {
      console.error('Invalid transaction type:', type);
      return NextResponse.json({ error: 'Invalid transaction type' }, { status: 400 });
    }

    console.log('Поиск пользователя:', telegramUser.id);
    const user = await prisma.user.findUnique({
      where: { telegramId: telegramUser.id.toString() }
    });

    if (!user) {
      console.error('User not found:', telegramUser.id);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('Создание транзакции...');
    const transaction = await prisma.transaction.create({
      data: {
        id: hash,
        type,
        amount,
        address,
        status: 'completed',
        userId: user.id,
        fee: fee as number,
        hash: hash,
        timestamp: new Date()
      } as Prisma.TransactionUncheckedCreateInput
    });

    console.log('Транзакция создана:', transaction);

    // Обновляем баланс кошелька
    console.log('Обновление баланса кошелька...');
    const wallet = await prisma.wallet.findFirst({
      where: { userId: user.id }
    });

    if (wallet) {
      const newBalance = type === 'deposit' 
        ? wallet.balance + amount 
        : wallet.balance - amount;
      
      await prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance }
      });
      console.log('Баланс обновлен:', newBalance);
    }

    return NextResponse.json(transaction);
  } catch (error) {
    console.error('Error in transactions API:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + (error as Error).message },
      { status: 500 }
    );
  }
} 