import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyTelegramWebAppData } from '@/utils/telegram';
import { TonClient, WalletContractV4 } from '@ton/ton';
import { getSecureRandomBytes, keyPairFromSeed } from '@ton/crypto';
import crypto from 'crypto';

// Инициализация TON клиента
const client = new TonClient({
  endpoint: 'https://toncenter.com/api/v2/jsonRPC'
});

// Функция для шифрования приватного ключа
function encryptPrivateKey(privateKey: string, initData: string): string {
  const algorithm = 'aes-256-gcm';
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash('sha256').update(initData).digest();
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const telegramInitData = request.headers.get('x-telegram-init-data');

    if (!telegramInitData) {
      return NextResponse.json({ error: 'No Telegram init data provided' }, { status: 401 });
    }

    const telegramUser = await verifyTelegramWebAppData(telegramInitData);
    if (!telegramUser) {
      return NextResponse.json({ error: 'Invalid Telegram init data' }, { status: 401 });
    }

    // Ищем пользователя
    let user = await prisma.user.findUnique({
      where: { telegramId: telegramUser.id.toString() },
      include: { wallets: true }
    });

    // Если пользователя нет, создаем его
    if (!user) {
      // Генерируем новый кошелек
      const seed = await getSecureRandomBytes(32);
      const keyPair = keyPairFromSeed(seed);
      const wallet = WalletContractV4.create({ 
        publicKey: keyPair.publicKey,
        workchain: 0 
      });

      // Создаем пользователя и кошелек
      user = await prisma.user.create({
        data: {
          telegramId: telegramUser.id.toString(),
          username: telegramUser.username,
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name,
          wallets: {
            create: {
              address: wallet.address.toString(),
              publicKey: keyPair.publicKey.toString('hex'),
              encryptedKey: encryptPrivateKey(
                keyPair.secretKey.toString('hex'),
                telegramInitData
              )
            }
          }
        },
        include: { wallets: true }
      });
    }

    // Возвращаем данные кошелька
    const wallet = user.wallets[0];
    return NextResponse.json({
      address: wallet.address,
      publicKey: wallet.publicKey,
      encryptedKey: wallet.encryptedKey
    });
  } catch (error) {
    console.error('Error in wallet API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
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
    const { type, amount, address } = body;

    // Проверяем тип операции
    if (!['deposit', 'withdrawal'].includes(type)) {
      return NextResponse.json({ error: 'Invalid transaction type' }, { status: 400 });
    }

    // Создаем транзакцию
    const user = await prisma.user.findUnique({
      where: { telegramId: telegramUser.id.toString() }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const transaction = await prisma.transaction.create({
      data: {
        type,
        amount,
        address,
        userId: user.id
      }
    });

    // Обновляем баланс кошелька
    const wallet = await prisma.wallet.findFirst({
      where: { userId: user.id }
    });

    if (wallet) {
      await prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: type === 'deposit' 
            ? wallet.balance + amount 
            : wallet.balance - amount
        }
      });
    }

    return NextResponse.json(transaction);
  } catch (error) {
    console.error('Error in wallet API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 