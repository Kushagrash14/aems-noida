import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AEMS v2 — Industrial Asset Management',
  description: 'Industrial-scale Asset Entry Management System for PG Electroplast Ltd. Normalized tracking, preventive maintenance, single session security, and role-scoped auditing.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} min-h-full bg-[#f8f9fa] text-stone-900 antialiased selection:bg-indigo-500 selection:text-white`}>
        {children}
      </body>
    </html>
  );
}
