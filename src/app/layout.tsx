import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Changelog',
  description: 'Product changelog',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[var(--body-bg)] text-[var(--body-color)] antialiased">{children}</body>
    </html>
  );
}
