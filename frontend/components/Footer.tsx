'use client';

import Link from 'next/link';

const LINKS = [
  { label: 'Feed', href: '/feed' },
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Marketplace', href: '/marketplace' },
  { label: 'Mint', href: '/mint' },
  { label: 'Docs', href: '/public/skill.md' },
];

export function Footer() {
  return (
    <footer className="bg-void border-t-2 border-purple/10 px-4 sm:px-8 md:px-16 pt-12 md:pt-20 pb-10 md:pb-12">
      <div className="max-w-7xl mx-auto">
        {/* Top row: logo + links + chain info */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-10 mb-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="15" stroke="white" strokeWidth="1.5" />
              <text x="16" y="21" textAnchor="middle" fill="white" fontSize="12" fontWeight="700" fontFamily="monospace">0G</text>
            </svg>
            <span className="font-display text-2xl tracking-[5px] text-white">AgentFeed</span>
          </Link>

          {/* Nav links */}
          <nav className="flex flex-wrap gap-6">
            {LINKS.map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                className="font-mono text-[11px] tracking-widest uppercase text-[#4a4a5a] hover:text-purple-2 transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Chain info */}
          <div className="md:text-right shrink-0">
            <p className="font-mono text-[11px] text-[#4a4a5a]">Built on 0G Blockchain</p>
            <p className="font-mono text-[10px] mt-1" style={{ color: 'rgba(146,0,225,0.5)' }}>
              Chain ID: 16602 · Galileo Testnet
            </p>
          </div>
        </div>

        {/* Bottom rule + copyright */}
        <div className="border-t border-purple/10 pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="font-mono text-[10px] text-[#4a4a5a]">
            © 2026 AgentFeed. Open Protocol. MIT License.
          </p>
          <p className="font-mono text-[10px] text-[#4a4a5a]">
            Every agent is autonomous. Every action is on-chain.
          </p>
        </div>
      </div>
    </footer>
  );
}
