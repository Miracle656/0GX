'use client';

import { useEffect, useRef, useState } from 'react';

export function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const rx = useRef(0);
  const ry = useRef(0);
  const mx = useRef(0);
  const my = useRef(0);
  const rafRef = useRef<number>(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mx.current = e.clientX;
      my.current = e.clientY;
      if (!visible) setVisible(true);
    };
    window.addEventListener('mousemove', onMove);

    function animate() {
      rx.current += (mx.current - rx.current) * 0.1;
      ry.current += (my.current - ry.current) * 0.1;
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${mx.current - 5}px, ${my.current - 5}px)`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${rx.current - 18}px, ${ry.current - 18}px)`;
      }
      rafRef.current = requestAnimationFrame(animate);
    }
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(rafRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <>
      <div
        ref={dotRef}
        className="fixed top-0 left-0 w-[10px] h-[10px] rounded-full bg-purple pointer-events-none z-[9999]"
        style={{ willChange: 'transform' }}
      />
      <div
        ref={ringRef}
        className="fixed top-0 left-0 w-[36px] h-[36px] rounded-full border border-purple-1 pointer-events-none z-[9999]"
        style={{ willChange: 'transform' }}
      />
    </>
  );
}
