import { NextApiRequest, NextApiResponse } from 'next';
import { getUserByTelegramId, createUser, createWallet } from '../../services/user';
import { getSecureRandomBytes, keyPairFromSeed } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { telegramId } = req.query;

  if (!telegramId) {
    return res.status(400).json({ error: 'Telegram ID is required' });
  }

  try {
    let user = await getUserByTelegramId(telegramId.toString());
    
    // Если пользователя нет, создаем его
    if (!user) {
      user = await createUser({
        telegramId: telegramId.toString()
      });

      if (!user) {
        throw new Error('Failed to create user');
      }

      // Создаем новый кошелек
      const seed = await getSecureRandomBytes(32);
      const keyPair = keyPairFromSeed(seed);
      const wallet = WalletContractV4.create({ 
        publicKey: keyPair.publicKey,
        workchain: 0 
      });

      const newWallet = await createWallet({
        userId: user.id,
        address: wallet.address.toString(),
        publicKey: Buffer.from(keyPair.publicKey).toString('hex'),
        encryptedKey: Buffer.from(keyPair.secretKey).toString('hex')
      });

      if (!newWallet) {
        throw new Error('Failed to create wallet');
      }

      return res.status(200).json({
        address: newWallet.address,
        publicKey: newWallet.publicKey,
        encryptedKey: newWallet.encryptedKey
      });
    }

    // Если у пользователя нет кошелька, создаем новый
    if (!user.wallets || user.wallets.length === 0) {
      const seed = await getSecureRandomBytes(32);
      const keyPair = keyPairFromSeed(seed);
      const wallet = WalletContractV4.create({ 
        publicKey: keyPair.publicKey,
        workchain: 0 
      });

      const newWallet = await createWallet({
        userId: user.id,
        address: wallet.address.toString(),
        publicKey: Buffer.from(keyPair.publicKey).toString('hex'),
        encryptedKey: Buffer.from(keyPair.secretKey).toString('hex')
      });

      if (!newWallet) {
        throw new Error('Failed to create wallet');
      }

      return res.status(200).json({
        address: newWallet.address,
        publicKey: newWallet.publicKey,
        encryptedKey: newWallet.encryptedKey
      });
    }

    // Возвращаем существующий кошелек
    const wallet = user.wallets[0];
    return res.status(200).json({
      address: wallet.address,
      publicKey: wallet.publicKey,
      encryptedKey: wallet.encryptedKey
    });
  } catch (error) {
    console.error('Error handling wallet request:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 