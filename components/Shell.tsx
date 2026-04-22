import Link from "next/link";
import { TokenBanner } from "./TokenBanner";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <TokenBanner />
      <header className="border-b border-ink-200/70 bg-white/60 backdrop-blur sticky top-0 z-20">
        <div className="max-w-[1280px] mx-auto px-6 py-4 flex items-baseline gap-8">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="font-display text-2xl text-primary-700 leading-none">Picta</span>
            <span className="font-script text-xl text-tertiary-500 leading-none">dashboard</span>
          </Link>
          <nav className="flex gap-5 text-sm text-ink-600">
            <Link href="/" className="hover:text-primary-700 transition">
              Overview
            </Link>
            <Link href="/compare" className="hover:text-primary-700 transition">
              Compare
            </Link>
          </nav>
          <div className="flex-1" />
          <span className="text-xs text-ink-400">@pictaphotoapp · organic only</span>
        </div>
      </header>
      <main className="max-w-[1280px] mx-auto px-6 py-10">{children}</main>
      <footer className="max-w-[1280px] mx-auto px-6 py-8 text-xs text-ink-400">
        All times in America/New_York · Organic only · Owner-posted content
      </footer>
    </div>
  );
}
