import type { Metadata, Viewport } from 'next';
import { Anek_Latin } from 'next/font/google';
import NextTopLoader from 'nextjs-toploader';
import { Providers } from './providers';
import './globals.css';

const anek = Anek_Latin({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-anek',
  display: 'swap',
  axes: ['wdth'],
});

export const metadata: Metadata = {
  title: { default: 'Hajira', template: '%s · Hajira' },
  description: 'Attendance and leave, stitched together: check in, apply for leave, approve and report.',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#1e2756' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0d1e' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={anek.variable} suppressHydrationWarning>
      <body className="min-h-dvh">
        <NextTopLoader color="#f2b33d" height={3} showSpinner={false} shadow={false} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
