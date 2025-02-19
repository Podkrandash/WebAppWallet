import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не поддерживается' });
  }

  try {
    const initData = req.headers['x-telegram-init-data'];
    if (!initData || typeof initData !== 'string') {
      return res.status(400).json({ error: 'Отсутствуют данные инициализации Telegram' });
    }

    const { encryptedKey } = req.body;
    if (!encryptedKey) {
      return res.status(400).json({ error: 'Отсутствует зашифрованный ключ' });
    }

    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      return res.status(500).json({ error: 'Ключ шифрования не найден' });
    }

    // Разбираем зашифрованный ключ
    const [ivHex, authTagHex, encryptedDataHex] = encryptedKey.split(':');
    if (!ivHex || !authTagHex || !encryptedDataHex) {
      return res.status(400).json({ error: 'Некорректный формат зашифрованного ключа' });
    }

    // Преобразуем компоненты из hex
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encryptedData = Buffer.from(encryptedDataHex, 'hex');

    // Создаем decipher
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(encryptionKey, 'hex'), iv);
    decipher.setAuthTag(authTag);

    // Расшифровываем
    const decrypted = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final()
    ]);

    return res.status(200).json({ secretKey: decrypted.toString('hex') });
  } catch (error) {
    console.error('Ошибка расшифровки:', error);
    return res.status(500).json({ error: 'Ошибка при расшифровке ключа' });
  }
} 