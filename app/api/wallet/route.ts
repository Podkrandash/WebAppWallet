import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { verifyTelegramWebAppData } from '../../../utils/telegram';
import { TonClient, WalletContractV4 } from '@ton/ton';
import { getSecureRandomBytes, keyPairFromSeed } from '@ton/crypto';
import crypto from 'crypto';

// Инициализация TON клиента
const TONCENTER_API_KEY = process.env.TONCENTER_API_KEY;
if (!TONCENTER_API_KEY) {
  throw new Error('TONCENTER_API_KEY not found in environment variables');
}

const client = new TonClient({
  endpoint: 'https://toncenter.com/api/v2/jsonRPC',
  apiKey: TONCENTER_API_KEY
});

// Функция для шифрования приватного ключа
function encryptPrivateKey(privateKey: string, initData: string): string {
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
  if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY not found in environment variables');
  }

  const algorithm = 'aes-256-gcm';
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

export async function GET(request: Request) {
  try {
    const telegramInitData = request.headers.get('x-telegram-init-data');
    if (!telegramInitData) {
      return NextResponse.json({ error: 'No Telegram init data provided' }, { status: 401 });
    }

    console.log('Telegram init data:', telegramInitData);

    const telegramUser = await verifyTelegramWebAppData(telegramInitData);
    if (!telegramUser) {
      return NextResponse.json({ error: 'Invalid Telegram init data' }, { status: 401 });
    }

    console.log('Telegram user:', telegramUser);

    // Ищем пользователя
    let user = await prisma.user.findUnique({
      where: { telegramId: telegramUser.id.toString() },
      include: { wallets: true }
    });

    console.log('Existing user:', user);

    // Если пользователя нет, создаем его
    if (!user) {
      try {
        // Генерируем новый кошелек
        const seed = await getSecureRandomBytes(32);
        const keyPair = keyPairFromSeed(seed);
        const wallet = WalletContractV4.create({ 
          publicKey: keyPair.publicKey,
          workchain: 0 
        });

        console.log('Generated wallet address:', wallet.address.toString());

        // Шифруем приватный ключ
        const encryptedKey = encryptPrivateKey(
          keyPair.secretKey.toString('hex'),
          telegramInitData
        );

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
                encryptedKey: encryptedKey,
                balance: 0
              }
            }
          },
          include: { wallets: true }
        });

        console.log('Created new user:', user);
      } catch (error) {
        console.error('Error creating wallet:', error);
        return NextResponse.json(
          { error: 'Failed to create wallet: ' + (error as Error).message },
          { status: 500 }
        );
      }
    }

    // Возвращаем данные кошелька
    const wallet = user.wallets[0];
    if (!wallet) {
      return NextResponse.json(
        { error: 'No wallet found for user' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      address: wallet.address,
      publicKey: wallet.publicKey,
      encryptedKey: wallet.encryptedKey
    });
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