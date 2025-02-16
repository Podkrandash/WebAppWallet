import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { verifyTelegramWebAppData } from '../../../utils/telegram';
import { TonClient, WalletContractV4 } from '@ton/ton';
import { getSecureRandomBytes, keyPairFromSeed } from '@ton/crypto';
import crypto from 'crypto';

export async function GET(request: Request) {
  try {
    // Проверяем наличие необходимых переменных окружения
    const TONCENTER_API_KEY = process.env.TONCENTER_API_KEY;
    if (!TONCENTER_API_KEY) {
      return NextResponse.json(
        { error: 'TONCENTER_API_KEY not found in environment variables' },
        { status: 500 }
      );
    }

    const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
    if (!ENCRYPTION_KEY) {
      return NextResponse.json(
        { error: 'ENCRYPTION_KEY not found in environment variables' },
        { status: 500 }
      );
    }

    // Инициализация TON клиента
    const client = new TonClient({
      endpoint: 'https://toncenter.com/api/v2/jsonRPC',
      apiKey: TONCENTER_API_KEY
    });

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
    const { type, amount, address } = body;

    console.log('Данные транзакции:', { type, amount, address });

    // Проверяем тип операции
    if (!['deposit', 'withdrawal'].includes(type)) {
      console.error('Invalid transaction type:', type);
      return NextResponse.json({ error: 'Invalid transaction type' }, { status: 400 });
    }

    console.log('Поиск пользователя:', telegramUser.id);
    // Создаем транзакцию
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
        type,
        amount,
        address,
        userId: user.id
      }
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
    console.error('Error in wallet API:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + (error as Error).message },
      { status: 500 }
    );
  }
} 