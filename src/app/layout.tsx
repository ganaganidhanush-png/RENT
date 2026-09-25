import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/layout/sidebar';
import Header from '@/components/layout/header';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'RentVault - Micro Property Management',
  description: 'Manage 5 rental rooms, tenant onboarding, rent ledger, and secure ID document vault.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-slate-50 antialiased">
      <body className={`${inter.className} min-h-full flex`}>
        {/* Left Sidebar */}
        <Sidebar />

        {/* Right Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 min-h-screen">
          <Header />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
