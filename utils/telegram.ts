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
    console.log('Проверка initData:', {
      length: initData?.length,
      hasHash: initData?.includes('hash='),
      hasUser: initData?.includes('user='),
      isValidFormat: /^[a-zA-Z0-9=&%]+$/.test(initData || '')
    });

    // Проверяем, что initData не пустой
    if (!initData) {
      console.error('InitData отсутствует');
      return null;
    }

    // Проверяем базовый формат
    if (!initData.includes('hash=') || !initData.includes('user=')) {
      console.error('Отсутствуют обязательные параметры в initData');
      return null;
    }

    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    
    if (!hash) {
      console.error('Отсутствует hash в initData');
      return null;
    }

    // Удаляем hash из параметров перед проверкой
    urlParams.delete('hash');

    // Получаем все параметры и сортируем их
    const params = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b));

    console.log('Параметры для проверки:', params);

    // Создаем строку для проверки
    const dataCheckString = params
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Получаем токен бота
    const botToken = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('Отсутствует токен бота в переменных окружения');
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

    console.log('Сравнение хешей:', {
      calculated: calculatedHash,
      received: hash,
      match: calculatedHash === hash
    });

    // Проверяем совпадение хешей
    if (calculatedHash !== hash) {
      console.error('Хеши не совпадают');
      return null;
    }

    // Получаем данные пользователя
    const user = urlParams.get('user');
    if (!user) {
      console.error('Отсутствуют данные пользователя в initData');
      return null;
    }

    try {
      // Парсим данные пользователя
      const userData = JSON.parse(user) as TelegramUser;
      
      // Проверяем обязательные поля
      if (!userData.id || !userData.first_name) {
        console.error('Отсутствуют обязательные поля пользователя:', userData);
        return null;
      }

      console.log('Данные пользователя проверены:', {
        id: userData.id,
        username: userData.username || 'не указан'
      });
      
      return userData;
    } catch (parseError) {
      console.error('Ошибка парсинга данных пользователя:', parseError);
      return null;
    }
  } catch (error) {
    console.error('Ошибка проверки данных Telegram:', error);
    return null;
  }
} 