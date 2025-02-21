import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';
import { verifyTelegramWebAppData } from '../../utils/telegram';

interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Проверяем данные Telegram
    const initData = req.headers['x-telegram-init-data'] as string;
    if (!initData) {
      return res.status(401).json({ error: 'Отсутствуют данные авторизации' });
    }

    const telegramData = await verifyTelegramWebAppData(initData) as TelegramUser;
    if (!telegramData) {
      return res.status(401).json({ error: 'Неверные данные авторизации' });
    }

    // Получаем или создаем пользователя
    const user = await prisma.user.upsert({
      where: { telegramId: telegramData.id.toString() },
      update: {
        username: telegramData.username,
        firstName: telegramData.first_name,
        lastName: telegramData.last_name
      },
      create: {
        telegramId: telegramData.id.toString(),
        username: telegramData.username,
        firstName: telegramData.first_name,
        lastName: telegramData.last_name
      }
    });

    if (req.method === 'GET') {
      // Получаем существующий кошелек
      const wallet = await prisma.wallet.findFirst({
        where: { userId: user.id }
      });

      if (!wallet) {
        return res.status(404).json({ error: 'Кошелек не найден' });
      }

      return res.json({
        address: wallet.address,
        publicKey: wallet.publicKey,
        privateKey: wallet.privateKey
      });
    }

    if (req.method === 'POST') {
      const { address, publicKey, privateKey } = req.body;

      // Создаем новый кошелек
      const wallet = await prisma.wallet.create({
        data: {
          address,
          publicKey,
          privateKey,
          userId: user.id,
          balance: 0,
          usdtBalance: 0,
          earthBalance: 0
        }
      });

      return res.json({
        address: wallet.address,
        publicKey: wallet.publicKey,
        privateKey: wallet.privateKey
      });
    }

    return res.status(405).json({ error: 'Метод не поддерживается' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
} 