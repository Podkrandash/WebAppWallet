import crypto from 'crypto';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export async function verifyTelegramWebAppData(initData: string): Promise<TelegramUser | null> {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    
    if (!hash) {
      console.error('No hash in initData');
      return null;
    }

    // Удаляем hash из параметров перед проверкой
    urlParams.delete('hash');

    // Сортируем параметры в алфавитном порядке
    const dataCheckArray = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`);

    // Создаем строку для проверки
    const dataCheckString = dataCheckArray.join('\n');

    // Получаем токен бота из переменных окружения
    const botToken = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('No bot token in env');
      return null;
    }

    // Создаем секретный ключ
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // Вычисляем хеш
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Проверяем совпадение хешей
    if (calculatedHash !== hash) {
      console.error('Hash mismatch:', {
        calculated: calculatedHash,
        received: hash,
        dataCheckString
      });
      return null;
    }

    // Получаем данные пользователя
    const user = urlParams.get('user');
    if (!user) {
      console.error('No user data in initData');
      return null;
    }

    // Парсим данные пользователя
    const userData = JSON.parse(user) as TelegramUser;
    if (!userData.id) {
      console.error('Invalid user data:', userData);
      return null;
    }

    return userData;
  } catch (error) {
    console.error('Error verifying Telegram data:', error);
    return null;
  }
} 