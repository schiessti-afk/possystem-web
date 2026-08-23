import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "POS Remote Dashboard",
  description: "Read-only observation dashboard for remote POS registers",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="brand">
            <span className="brand-dot" aria-hidden />
            POS Remote
          </div>
          <nav>
            <Link href="/">Overview</Link>
            <Link href="/shifts">Shifts</Link>
          </nav>
        </header>
        <main className="container">{children}</main>
        <footer className="footer">
          Read-only observation · data arrives via one-way sync from registers
        </footer>
      </body>
    </html>
  );
}
