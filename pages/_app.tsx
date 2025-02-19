import type { AppProps } from 'next/app';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <MantineProvider>
      <Component {...pageProps} />
    </MantineProvider>
  );
} 