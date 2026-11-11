import { useEffect, useRef, useState } from 'react';

export function Avatar({ src, className }: { src: string; className: string }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [visibleSrc, setVisibleSrc] = useState<string | null>(null);

  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;

    // Native lazy loading can fetch images far outside the viewport.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisibleSrc(src);
          observer.disconnect();
        }
      },
      { rootMargin: '200px 0px' },
    );
    observer.observe(image);
    return () => observer.disconnect();
  }, [src]);

  return (
    <img
      ref={imageRef}
      src={visibleSrc === src ? src : undefined}
      alt=""
      width="28"
      height="28"
      loading="lazy"
      className={className}
    />
  );
}
