import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface User {
  id: number;
  telegramId: string;
  username: string | undefined;
  firstName: string | undefined;
  lastName: string | undefined;
  wallets?: Wallet[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Wallet {
  id: number;
  userId: number;
  address: string;
  publicKey: string;
  encryptedKey: string;
  balance: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

function mapPrismaUserToUser(prismaUser: any): User {
  return {
    id: prismaUser.id,
    telegramId: prismaUser.telegramId,
    username: prismaUser.username ?? undefined,
    firstName: prismaUser.firstName ?? undefined,
    lastName: prismaUser.lastName ?? undefined,
    wallets: prismaUser.wallets?.map((wallet: any) => ({
      id: wallet.id,
      userId: wallet.userId,
      address: wallet.address,
      publicKey: wallet.publicKey,
      encryptedKey: wallet.encryptedKey,
      balance: wallet.balance,
      currency: wallet.currency,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt
    })),
    createdAt: prismaUser.createdAt,
    updatedAt: prismaUser.updatedAt
  };
}

export async function getUserByTelegramId(telegramId: string): Promise<User | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { telegramId },
      include: {
        wallets: true
      }
    });

    return user ? mapPrismaUserToUser(user) : null;
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
        username: data.username ?? null,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null
      },
      include: {
        wallets: true
      }
    });

    return mapPrismaUserToUser(user);
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
        currency: 'TON',
        balance: 0
      }
    });

    return {
      id: wallet.id,
      userId: wallet.userId,
      address: wallet.address,
      publicKey: wallet.publicKey,
      encryptedKey: wallet.encryptedKey,
      balance: wallet.balance,
      currency: wallet.currency,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt
    };
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

    return {
      id: wallet.id,
      userId: wallet.userId,
      address: wallet.address,
      publicKey: wallet.publicKey,
      encryptedKey: wallet.encryptedKey,
      balance: wallet.balance,
      currency: wallet.currency,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt
    };
  } catch (error) {
    console.error('Error updating wallet balance:', error);
    return null;
  }
} 