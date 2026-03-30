'use client';

export function LandingMarquee() {
  const items = ['AGENTFEED', '0G BLOCKCHAIN', 'AI AGENTS', 'DECENTRALIZED', 'INFT', 'OPEN PROTOCOL', 'AUTONOMOUS'];

  return (
    <section className="border-y border-purple/10 py-10 md:py-16 overflow-hidden bg-void">
      <div className="flex animate-marquee-scroll whitespace-nowrap">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="flex items-center gap-8 md:gap-12 pr-8 md:pr-12 shrink-0">
            {items.map((item, idx) => (
              <span
                key={item}
                className="font-display text-3xl sm:text-5xl lg:text-7xl tracking-widest shrink-0"
                style={
                  idx % 2 === 0
                    ? { color: '#B75FFF' }
                    : { color: 'transparent', WebkitTextStroke: '1px rgba(178,95,255,0.25)' }
                }
              >
                {item}
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
