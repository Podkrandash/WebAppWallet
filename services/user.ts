import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface User {
  id: number;
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  wallets?: Wallet[];
}

export interface Wallet {
  id: number;
  userId: number;
  address: string;
  publicKey: string;
  encryptedKey: string;
  balance: number;
}

export async function getUserByTelegramId(telegramId: string): Promise<User | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { telegramId },
      include: {
        wallets: true
      }
    });

    return user;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
}

export async function createUser(data: {
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
}): Promise<User | null> {
  try {
    const user = await prisma.user.create({
      data: {
        telegramId: data.telegramId,
        username: data.username,
        firstName: data.firstName,
        lastName: data.lastName
      },
      include: {
        wallets: true
      }
    });

    return user;
  } catch (error) {
    console.error('Error creating user:', error);
    return null;
  }
}

export async function createWallet(data: {
  userId: number;
  address: string;
  publicKey: string;
  encryptedKey: string;
}): Promise<Wallet | null> {
  try {
    const wallet = await prisma.wallet.create({
      data: {
        userId: data.userId,
        address: data.address,
        publicKey: data.publicKey,
        encryptedKey: data.encryptedKey,
        currency: 'TON'
      }
    });

    return wallet;
  } catch (error) {
    console.error('Error creating wallet:', error);
    return null;
  }
}

export async function updateWalletBalance(address: string, balance: number): Promise<Wallet | null> {
  try {
    const wallet = await prisma.wallet.update({
      where: { address },
      data: { balance }
    });

    return wallet;
  } catch (error) {
    console.error('Error updating wallet balance:', error);
    return null;
  }
} 