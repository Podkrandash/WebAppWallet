/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_ENCRYPTION_KEY: process.env.NEXT_PUBLIC_ENCRYPTION_KEY,
  },
  // Отключаем строгий режим для совместимости с некоторыми пакетами
  reactStrictMode: false,
}

module.exports = nextConfig 