import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'A.E.M.S',
  description: 'Asset Entry Management System - PG Electroplast Ltd',
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
