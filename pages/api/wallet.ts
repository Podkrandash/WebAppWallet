import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { telegramId } = req.query;

  if (!telegramId || typeof telegramId !== 'string') {
    return res.status(400).json({ error: 'Telegram ID is required' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { telegramId },
      include: {
        wallets: true
      }
    });
    
    if (!user || !user.wallets || user.wallets.length === 0) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const wallet = user.wallets[0];

    return res.status(200).json({
      address: wallet.address,
      publicKey: wallet.publicKey,
      encryptedKey: wallet.encryptedKey
    });
  } catch (error) {
    console.error('Error getting wallet:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 