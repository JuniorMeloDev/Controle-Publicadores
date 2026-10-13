'use client';

import { useEffect, useRef, useState } from 'react';
import S21Card from './S21Card';

export default function S21Preview(props) {
  const container = useRef(null);
  const card = useRef(null);
  const [size, setSize] = useState({ scale: 1, height: 0 });
  useEffect(() => {
    const measure = () => {
      const width = container.current.clientWidth;
      const height = card.current.offsetHeight;
      const available = Math.max(280, window.innerHeight - container.current.getBoundingClientRect().top - 24);
      const scale = Math.min(1, width / 794, window.innerWidth >= 1024 ? available / height : 1);
      setSize({ scale, height: height * scale });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(container.current);
    observer.observe(card.current);
    window.addEventListener('resize', measure);
    measure();
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, []);
  return <div ref={container} className="printable-content !block w-full overflow-hidden print:overflow-visible print:!h-auto" style={{ height: size.height || undefined }}>
    <div className="mx-auto print:!w-full" style={{ width: 794 * size.scale }}>
      <div ref={card} className="origin-top-left [&_.bg-white]:!bg-white [&_.text-black]:!text-black [&_.bg-blue-50]:!bg-blue-50 print:!w-full print:!transform-none" style={{ width: 794, transform: `scale(${size.scale})` }}>
        <S21Card {...props} />
      </div>
    </div>
  </div>;
}
