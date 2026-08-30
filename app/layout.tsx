import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { logout } from "./login/actions";
import { getSessionToken } from "@/lib/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "POS Remote Dashboard",
  description: "Read-only observation dashboard for remote POS registers",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // Navigation is pointless before sign-in, and the login screen is the one
  // page rendered without a session.
  const signedIn = Boolean(getSessionToken());

  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="brand">
            <Icon name="cash" size={20} className="brand-mark" />
            POS Remote
          </div>
          {signedIn ? (
            <nav>
              <Link href="/">
                <Icon name="wallet" size={15} />
                Overview
              </Link>
              <Link href="/shifts">
                <Icon name="drawer-open" size={15} />
                Shifts
              </Link>
              <form action={logout}>
                <button type="submit" className="logout">
                  <Icon name="offline" size={15} />
                  Sign out
                </button>
              </form>
            </nav>
          ) : null}
        </header>
        <main className="container">{children}</main>
        <footer className="footer">
          Read-only observation · data arrives via one-way sync from registers
        </footer>
      </body>
    </html>
  );
}
