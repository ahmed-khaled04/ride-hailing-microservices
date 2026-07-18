import { useEffect, useState } from "react";
import "./RouteVisual.css";

const PATH = "M 40 260 C 120 180, 90 90, 200 60 S 340 40, 380 20";

function useTicker() {
  const [tick, setTick] = useState({ lat: 37.7749, lng: -122.4194 });

  useEffect(() => {
    const id = setInterval(() => {
      setTick((prev) => ({
        lat: prev.lat + (Math.random() - 0.5) * 0.0015,
        lng: prev.lng + (Math.random() - 0.5) * 0.0015,
      }));
    }, 1400);
    return () => clearInterval(id);
  }, []);

  return tick;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const listener = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  return reduced;
}

export function RouteVisual() {
  const { lat, lng } = useTicker();
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className="route-visual" aria-hidden="true">
      <div className="route-visual__grid" />
      <svg
        className="route-visual__svg"
        viewBox="0 0 420 300"
        fill="none"
        preserveAspectRatio="xMidYMid meet"
      >
        <path className="route-visual__path" d={PATH} />
        <path className="route-visual__path-glow" d={PATH} />
        <circle className="route-visual__pin route-visual__pin--start" cx="40" cy="260" r="6" />
        <circle className="route-visual__pin route-visual__pin--end" cx="380" cy="20" r="6" />
        <circle className="route-visual__dot" r="5">
          {!reducedMotion && (
            <animateMotion dur="4.5s" repeatCount="indefinite" path={PATH} />
          )}
        </circle>
      </svg>
      <div className="route-visual__ticker">
        <span>{lat.toFixed(4)}</span>
        <span className="route-visual__ticker-sep">/</span>
        <span>{lng.toFixed(4)}</span>
        <span className="route-visual__ticker-label">tracking</span>
      </div>
    </div>
  );
}
