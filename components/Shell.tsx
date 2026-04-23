import Link from "next/link";
import { TokenBanner } from "./TokenBanner";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <TokenBanner />
      <header className="border-b border-ink-200/70 bg-white/70 backdrop-blur sticky top-0 z-20">
        <div className="max-w-[1280px] mx-auto px-6 py-4 flex items-baseline gap-8">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="font-display text-2xl text-primary-800 leading-none">Picta</span>
            <span className="font-script text-2xl text-tertiary-500 leading-none">Organic</span>
            <span className="font-display text-2xl text-primary-800 leading-none">SoMe</span>
          </Link>
          <nav className="flex gap-5 text-sm text-ink-600 ml-2">
            <Link href="/" className="hover:text-primary-800 transition">
              Insta Overview
            </Link>
            <Link href="/compare" className="hover:text-primary-800 transition">
              Insta Compare
            </Link>
          </nav>
          <div className="flex-1" />
          <span className="inline-flex items-center gap-2 rounded-full bg-primary-50 text-primary-800 text-[11px] font-medium px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
            @pictaphotoapp · organic · no crossposts
          </span>
        </div>
      </header>
      <main className="max-w-[1280px] mx-auto px-6 py-10">{children}</main>
      <footer className="max-w-[1280px] mx-auto px-6 py-8 text-xs text-ink-400">
        All times in America/New_York · Organic only · Owner-posted content (no crossposts) · No ads/boosted
      </footer>
    </div>
  );
}
