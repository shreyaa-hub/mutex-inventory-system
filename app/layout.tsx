import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import { Activity } from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Allo Inventory",
  description: "Concurrency-safe inventory and reservation platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-slate-50/50">
      <body
        className={`${inter.className} min-h-full flex flex-col text-slate-900 antialiased`}
      >
        <Providers>
          <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-600 text-white shadow-sm shadow-teal-600/20">
                  <Activity className="h-5 w-5" />
                </div>

                <div>
                  <span className="text-base font-semibold tracking-tight text-slate-950">
                    Allo Inventory
                  </span>

                  <span className="ml-2 rounded-md bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700 ring-1 ring-inset ring-teal-600/10">
                    Reservation System
                  </span>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </main>

          <footer className="border-t border-slate-200 bg-white py-6">
            <div className="mx-auto max-w-7xl px-4 text-center text-xs text-slate-400 sm:px-6 lg:px-8">
              © {new Date().getFullYear()} Allo Inventory Platform
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}