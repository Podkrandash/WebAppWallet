import { prisma } from '../lib/prisma';
import crypto from 'crypto';
import fs from 'fs';

async function exportKeys() {
  try {
    // Получаем все кошельки из базы
    const wallets = await prisma.wallet.findMany({
      include: {
        user: true
      }
    });

    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY не найден в переменных окружения');
    }

    // Расшифровываем каждый ключ
    const exportData = wallets.map(wallet => {
      try {
        const [ivHex, authTagHex, encryptedDataHex] = wallet.encryptedKey.split(':');
        
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const encryptedData = Buffer.from(encryptedDataHex, 'hex');

        const decipher = crypto.createDecipheriv(
          'aes-256-gcm', 
          Buffer.from(encryptionKey, 'hex'), 
          iv
        );
        
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([
          decipher.update(encryptedData),
          decipher.final()
        ]);

        return {
          telegramId: wallet.user.telegramId,
          username: wallet.user.username,
          address: wallet.address,
          publicKey: wallet.publicKey,
          secretKey: decrypted.toString('hex')
        };
      } catch (error) {
        console.error(`Ошибка расшифровки для кошелька ${wallet.address}:`, error);
        return null;
      }
    }).filter(Boolean);

    // Сохраняем в файл
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `wallet-keys-${timestamp}.json`;
    
    fs.writeFileSync(
      filename, 
      JSON.stringify(exportData, null, 2)
    );

    console.log(`Экспортировано ${exportData.length} кошельков в файл ${filename}`);
  } catch (error) {
    console.error('Ошибка экспорта:', error);
  } finally {
    await prisma.$disconnect();
  }
}

exportKeys(); 