import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyTelegramWebAppData } from '@/utils/telegram';

export async function GET(request: Request) {
  try {
    const telegramInitData = request.headers.get('x-telegram-init-data');
    if (!telegramInitData) {
      return NextResponse.json({ error: 'No Telegram init data provided' }, { status: 401 });
    }

    const telegramUser = await verifyTelegramWebAppData(telegramInitData);
    if (!telegramUser) {
      return NextResponse.json({ error: 'Invalid Telegram init data' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { telegramId: telegramUser.id.toString() }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Получаем транзакции пользователя
    const transactions = await prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { timestamp: 'desc' },
      take: 50
    });

    return NextResponse.json(transactions);
  } catch (error) {
    console.error('Error in transactions API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 