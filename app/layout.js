import { Outfit } from 'next/font/google';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '600', '800'],
  variable: '--font-outfit',
});

export const metadata = {
  title: 'Glass Tetris - Next.js Edition',
  description: 'A beautiful glassmorphism style Tetris game with smooth animations and vibrant colors, now powered by Next.js.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className={outfit.variable}>
      <body>{children}</body>
    </html>
  );
}
