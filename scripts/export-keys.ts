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
        if (!wallet.privateKey) {
          console.log(`Пропускаем кошелек ${wallet.address}: нет приватного ключа`);
          return null;
        }

        return {
          telegramId: wallet.user.telegramId,
          username: wallet.user.username,
          address: wallet.address,
          publicKey: wallet.publicKey,
          secretKey: wallet.privateKey
        };
      } catch (error) {
        console.error(`Ошибка экспорта для кошелька ${wallet.address}:`, error);
        return null;
      }
    }).filter(Boolean); // Удаляем null значения

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