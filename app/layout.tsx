import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://truco-venezolano.gga.chatgpt.site'),
  title: 'Truco — La mesa venezolana en línea',
  description:
    'Partidas de Truco venezolano con reglas claras, salas privadas y voz opcional de mesa.',
  applicationName: 'Truco',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
  appleWebApp: {
    capable: true,
    title: 'Truco',
    statusBarStyle: 'default',
  },
  openGraph: {
    title: 'Truco — La mesa venezolana en línea',
    description:
      'Arma la mesa, acuerda las reglas y juega Truco venezolano con los tuyos.',
    type: 'website',
    locale: 'es_VE',
    images: [
      {
        url: '/og.png',
        width: 1731,
        height: 909,
        alt: 'Truco — La mesa venezolana en línea',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Truco — La mesa venezolana en línea',
    description: 'Arma la mesa, acuerda las reglas y juega con los tuyos.',
    images: ['/og.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#91442f',
  colorScheme: 'light',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-VE">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
