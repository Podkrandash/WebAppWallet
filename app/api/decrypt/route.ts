import { NextResponse } from 'next/server';
import { verifyTelegramWebAppData } from '../../../utils/telegram';

export async function POST(request: Request) {
  try {
    const telegramInitData = request.headers.get('x-telegram-init-data');
    if (!telegramInitData) {
      return NextResponse.json({ error: 'No Telegram init data provided' }, { status: 401 });
    }

    if (!await verifyTelegramWebAppData(telegramInitData)) {
      return NextResponse.json({ error: 'Invalid Telegram init data' }, { status: 401 });
    }

    const { encryptedKey } = await request.json();
    if (!encryptedKey) {
      return NextResponse.json({ error: 'No encrypted key provided' }, { status: 400 });
    }

    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Разбираем зашифрованный ключ
    const [ivHex, authTagHex, encryptedDataHex] = encryptedKey.split(':');
    if (!ivHex || !authTagHex || !encryptedDataHex) {
      return NextResponse.json({ error: 'Invalid encrypted key format' }, { status: 400 });
    }

    // Преобразуем компоненты из hex
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encryptedData = Buffer.from(encryptedDataHex, 'hex');

    // Создаем ключ расшифровки
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(encryptionKey),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // Объединяем зашифрованные данные с тегом аутентификации
    const encryptedBuffer = Buffer.concat([encryptedData, authTag]);

    // Расшифровываем
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128
      },
      key,
      encryptedBuffer
    );

    return NextResponse.json({ 
      secretKey: Buffer.from(decrypted).toString('hex')
    });
  } catch (error) {
    console.error('Ошибка расшифровки:', error);
    return NextResponse.json({ 
      error: 'Decryption error: ' + (error as Error).message 
    }, { status: 500 });
  }
} 