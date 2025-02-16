import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { verifyTelegramWebAppData } from '../../../utils/telegram';

export async function GET(request: Request) {
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

    console.log('Поиск пользователя:', telegramUser.id);
    const user = await prisma.user.findUnique({
      where: { telegramId: telegramUser.id.toString() }
    });

    if (!user) {
      console.error('User not found:', telegramUser.id);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('Получение транзакций для пользователя:', user.id);
    // Получаем транзакции пользователя
    const transactions = await prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { timestamp: 'desc' },
      take: 50
    });

    console.log('Найдено транзакций:', transactions.length);
    return NextResponse.json(transactions);
  } catch (error) {
    console.error('Error in transactions API:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + (error as Error).message },
      { status: 500 }
    );
  }
} 