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
    // Добавляем отладочную информацию
    console.log('Raw initData:', initData);

    // Проверяем, что initData не пустой
    if (!initData) {
      console.error('InitData is empty');
      return null;
    }

    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    
    if (!hash) {
      console.error('No hash in initData');
      return null;
    }

    // Удаляем hash из параметров перед проверкой
    urlParams.delete('hash');

    // Получаем все параметры и сортируем их
    const params = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b));

    console.log('Sorted params:', params);

    // Создаем строку для проверки
    const dataCheckString = params
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    console.log('Data check string:', dataCheckString);

    // Получаем токен бота
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

    console.log('Hash comparison:', {
      calculated: calculatedHash,
      received: hash
    });

    // Проверяем совпадение хешей
    if (calculatedHash !== hash) {
      console.error('Hash mismatch');
      return null;
    }

    // Получаем данные пользователя
    const user = urlParams.get('user');
    if (!user) {
      console.error('No user data in initData');
      return null;
    }

    try {
      // Парсим данные пользователя
      const userData = JSON.parse(user) as TelegramUser;
      
      // Проверяем обязательные поля
      if (!userData.id || !userData.first_name) {
        console.error('Missing required user fields:', userData);
        return null;
      }

      console.log('Verified user data:', userData);
      return userData;
    } catch (parseError) {
      console.error('Error parsing user data:', parseError);
      return null;
    }
  } catch (error) {
    console.error('Error verifying Telegram data:', error);
    return null;
  }
} 