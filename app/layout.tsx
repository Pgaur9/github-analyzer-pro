import "./globals.css";
import type { ReactNode } from "react";
import { BookOpen, Zap } from "lucide-react";

export const metadata = {
  title: "GitHub Analyzer Pro",
  description: "README generator, repo insights, security scan, and PR flow"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Pill navbar with only Readme and Analyze */}
        <nav className="pillbar">
          <a href="/readme" className="active">
            <BookOpen className="h-4 w-4" /> Readme
          </a>
          <a href="/analyzer">
            <Zap className="h-4 w-4" /> Analyze
          </a>
        </nav>

        <main className="container py-8 space-y-8">{children}</main>

        <footer className="border-t border-white/10">
          <div className="container py-6 text-sm text-white/60">
            Built with Next.js 15 · Tailwind CSS
          </div>
        </footer>
      </body>
    </html>
  );
}