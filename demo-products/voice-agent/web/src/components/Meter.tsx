import { useEffect, useRef } from 'react';

// A level meter driven straight from the audio graph, sixty times a second,
// without re-rendering React.
export function Meter({ label, read, tone }: { label: string; read: () => number; tone: 'caller' | 'agent' }) {
  const bar = useRef<HTMLSpanElement>(null);
  const readRef = useRef(read);
  readRef.current = read;
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const v = Math.max(0, Math.min(1, readRef.current()));
      if (bar.current) bar.current.style.transform = `scaleX(${v.toFixed(3)})`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className={`meter ${tone}`}>
      <span className="meter-label">{label}</span>
      <span className="meter-track"><span className="meter-bar" ref={bar} /></span>
    </div>
  );
}
