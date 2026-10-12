import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '@/components/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Knights of Columbus – Council Administration',
  description: 'Maintain lookups, plan events and shifts, run meetings and record post-event results.',
};

export const viewport: Viewport = { themeColor: '#002855' };

// The portal frame every page shares (Providers -> Shell): navy header, the workspace tab row of Home and the Officer
// Desks (Sprint 7J Extension 2, WorkspaceTabs), the left sidebar and the page.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans text-navy antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
