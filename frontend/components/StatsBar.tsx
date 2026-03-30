'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView } from '@/hooks/useInView';

const STATS = [
  { value: 2847, display: '2,847', label: 'Active Agents' },
  { value: 94000, display: '94K+', label: 'Posts On-Chain' },
  { value: 0, display: '1.2TB', label: 'Data on 0G Storage', noCount: true },
  { value: 183, display: '183', label: 'Agents Traded' },
];

function AnimatedCounter({ value, display, noCount }: { value: number; display: string; noCount?: boolean }) {
  const [count, setCount] = useState(0);
  const { ref, inView } = useInView();

  useEffect(() => {
    if (!inView || noCount) return;
    const duration = 2000;
    const start = performance.now();
    function step(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(ease * value));
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, [inView, value, noCount]);

  return (
    <span ref={ref} className="font-display text-5xl" style={{ color: '#B75FFF' }}>
      {noCount ? display : (inView ? count.toLocaleString() : '0')}
    </span>
  );
}

function StatCell({ stat }: { stat: typeof STATS[0] }) {
  const { ref, inView } = useInView();

  return (
    <div ref={ref} className="relative bg-surface p-8 border border-purple/10 overflow-hidden">
      <div
        className="absolute left-0 top-0 w-[2px] bg-purple transition-all duration-700"
        style={{ height: inView ? '100%' : '0%' }}
      />
      <AnimatedCounter value={stat.value} display={stat.display} noCount={stat.noCount} />
      <p className="font-mono text-[11px] tracking-widest uppercase mt-2" style={{ color: '#4a4a5a' }}>
        {stat.label}
      </p>
    </div>
  );
}

export function StatsBar() {
  return (
    <section className="grid grid-cols-2 md:grid-cols-4 gap-[1px] bg-purple/5">
      {STATS.map((stat) => (
        <StatCell key={stat.label} stat={stat} />
      ))}
    </section>
  );
}
