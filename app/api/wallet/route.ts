import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { verifyTelegramWebAppData } from '../../../utils/telegram';
import { TonClient, WalletContractV4 } from '@ton/ton';
import { getSecureRandomBytes, keyPairFromSeed } from '@ton/crypto';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';

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

    // Находим пользователя и его кошелек
    const user = await prisma.user.findUnique({
      where: { telegramId: telegramUser.id.toString() },
      include: { wallets: true }
    });

    if (!user || user.wallets.length === 0) {
      return NextResponse.json(null);
    }

    return NextResponse.json(user.wallets[0]);
  } catch (error) {
    console.error('Error in wallet API:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + (error as Error).message },
      { status: 500 }
    );
  }
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

    const body = await request.json();
    
    // Если это запрос на создание кошелька
    if (body.address && body.publicKey) {
      // Создаем или находим пользователя
      const user = await prisma.user.upsert({
        where: { telegramId: telegramUser.id.toString() },
        update: {
          username: telegramUser.username,
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name
        },
        create: {
          telegramId: telegramUser.id.toString(),
          username: telegramUser.username,
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name
        }
      });

      // Создаем кошелек
      const wallet = await prisma.wallet.create({
        data: {
          address: body.address,
          publicKey: body.publicKey,
          privateKey: body.privateKey,
          userId: user.id,
          balance: 0,
          usdtBalance: 0,
          earthBalance: 0
        }
      });

      return NextResponse.json({
        address: wallet.address,
        publicKey: wallet.publicKey,
        privateKey: wallet.privateKey
      });
    } 
    // Если это запрос на создание транзакции
    else if (body.type && body.amount) {
      const { type, amount, address } = body;

      if (!['deposit', 'withdrawal'].includes(type)) {
        return NextResponse.json({ error: 'Invalid transaction type' }, { status: 400 });
      }

      const user = await prisma.user.findUnique({
        where: { telegramId: telegramUser.id.toString() }
      });

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const transaction = await prisma.transaction.create({
        data: {
          id: `${Date.now()}-${user.id}`,
          hash: `${Date.now()}-${user.id}`,
          type,
          amount,
          address,
          status: 'COMPLETED',
          userId: user.id,
          fee: 0,
          timestamp: new Date()
        }
      });

      // Обновляем баланс кошелька
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
      }

      return NextResponse.json(transaction);
    }

    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  } catch (error) {
    console.error('Error in wallet API:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const telegramInitData = request.headers.get('x-telegram-init-data');
    if (!telegramInitData) {
      return NextResponse.json({ error: 'No Telegram init data provided' }, { status: 401 });
    }

    const telegramUser = await verifyTelegramWebAppData(telegramInitData);
    if (!telegramUser) {
      return NextResponse.json({ error: 'Invalid Telegram init data' }, { status: 401 });
    }

    const { address, publicKey } = await request.json();

    // Находим пользователя
    const user = await prisma.user.findUnique({
      where: { telegramId: telegramUser.id.toString() }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Обновляем кошелек
    const wallet = await prisma.wallet.update({
      where: { address },
      data: { publicKey }
    });

    return NextResponse.json(wallet);
  } catch (error) {
    console.error('Error in wallet API:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

// Функция для шифрования приватного ключа
function encryptPrivateKey(privateKey: string, initData: string): string {
  try {
    console.log('=== Начало шифрования ключа ===');
    
    const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
    if (!ENCRYPTION_KEY) {
      throw new Error('ENCRYPTION_KEY not found in environment variables');
    }

    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(12);
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    
    console.log('Параметры шифрования:', {
      ivLength: iv.length,
      keyLength: key.length,
      privateKeyLength: privateKey.length
    });

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    console.log('Результат шифрования:', {
      encryptedLength: encrypted.length,
      authTagLength: authTag.length
    });

    const result = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    console.log('=== Шифрование ключа завершено успешно ===');
    
    return result;
  } catch (error) {
    console.error('=== Ошибка шифрования ключа ===', error);
    throw error;
  }
} 