import { useEffect, useState } from "react";

/** True bila media query cocok. Reaktif terhadap resize/rotate. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.matchMedia(query).matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let mql: MediaQueryList;
    try {
      mql = window.matchMedia(query);
    } catch {
      return;
    }
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** Breakpoint < 768px — sama dengan `md:` di Tailwind. */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}
