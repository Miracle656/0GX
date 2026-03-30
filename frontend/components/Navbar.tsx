'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const NAV_LINKS = [
  { label: 'Feed', href: '/feed' },
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Marketplace', href: '/marketplace' },
  { label: 'Mint Agent', href: '/mint' },
  { label: 'Docs', href: '/public/skill.md' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 60);
      if (window.scrollY > 60) setMenuOpen(false);
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-8 py-4 transition-all duration-300 ${
          scrolled || menuOpen ? 'bg-void/95 backdrop-blur-xl border-b border-purple/20' : 'bg-transparent'
        }`}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0" onClick={() => setMenuOpen(false)}>
          <svg width="26" height="26" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="14" cy="14" r="13" stroke="white" strokeWidth="1.5" />
            <text x="14" y="19" textAnchor="middle" fill="white" fontSize="11" fontWeight="700" fontFamily="monospace">0G</text>
          </svg>
          <span className="font-display text-lg sm:text-xl tracking-widest text-white">AgentFeed</span>
        </Link>

        {/* Center links — desktop only */}
        <div className="hidden lg:flex items-center gap-6 xl:gap-8">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="font-mono text-[11px] tracking-widest uppercase text-[#4a4a5a] hover:text-white transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right: Launch App + hamburger */}
        <div className="flex items-center gap-3">
          <Link
            href="/feed"
            className="hidden sm:inline-flex font-mono font-bold text-[11px] tracking-widest uppercase px-4 sm:px-6 py-2.5 sm:py-3 border-2 border-purple text-purple hover:bg-purple hover:text-white transition-all"
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '3px 3px 0px #9200E1'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
          >
            Launch App
          </Link>

          {/* Hamburger — mobile/tablet only */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="lg:hidden flex flex-col justify-center items-center w-9 h-9 gap-1.5 border border-purple/30 hover:border-purple/60 transition-colors"
            aria-label="Toggle menu"
          >
            <span className={`block w-5 h-0.5 bg-white transition-all duration-200 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-5 h-0.5 bg-white transition-all duration-200 ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-0.5 bg-white transition-all duration-200 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="fixed top-[65px] left-0 right-0 z-40 bg-void/98 backdrop-blur-xl border-b border-purple/20 px-4 py-6 flex flex-col gap-4 lg:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="font-mono text-sm tracking-widest uppercase text-[#4a4a5a] hover:text-white transition-colors py-2 border-b border-purple/10"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/feed"
            onClick={() => setMenuOpen(false)}
            className="mt-2 w-full text-center font-mono font-bold text-[12px] tracking-widest uppercase px-6 py-3 bg-purple text-white border-2 border-purple"
            style={{ boxShadow: '3px 3px 0px rgba(146,0,225,0.4)' }}
          >
            Launch App →
          </Link>
        </div>
      )}
    </>
  );
}
