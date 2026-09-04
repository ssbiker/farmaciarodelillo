import { useState, useEffect, useRef } from "react";

export function useScrollAnimation(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const currentRef = ref.current;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold }
    );

    if (currentRef) {
      obs.observe(currentRef);
    }

    return () => {
      obs.disconnect();
    };
  }, [threshold]);

  return { ref, visible };
}
