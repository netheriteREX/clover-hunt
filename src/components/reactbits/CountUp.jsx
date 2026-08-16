// Adapted from React Bits (https://reactbits.dev) — TextAnimations/CountUp.
// Swapped the `motion/react` import for the already-installed `framer-motion`;
// otherwise unmodified from upstream.
import { useInView, useMotionValue, useSpring } from "framer-motion";
import { useCallback, useEffect, useRef } from "react";

export default function CountUp({
  to,
  from = 0,
  direction = "up",
  delay = 0,
  duration = 1.2,
  className = "",
  startWhen = true,
  suffix = "",
}) {
  const ref = useRef(null);
  const motionValue = useMotionValue(direction === "down" ? to : from);

  const damping = 20 + 40 * (1 / duration);
  const stiffness = 100 * (1 / duration);
  const springValue = useSpring(motionValue, { damping, stiffness });
  const isInView = useInView(ref, { once: true, margin: "0px" });

  const formatValue = useCallback((latest) => Math.round(latest).toString(), []);

  useEffect(() => {
    if (ref.current) ref.current.textContent = formatValue(direction === "down" ? to : from) + suffix;
  }, [from, to, direction, formatValue, suffix]);

  useEffect(() => {
    if (isInView && startWhen) {
      const t = setTimeout(() => motionValue.set(direction === "down" ? from : to), delay * 1000);
      return () => clearTimeout(t);
    }
  }, [isInView, startWhen, motionValue, direction, from, to, delay]);

  useEffect(() => {
    const unsubscribe = springValue.on("change", (latest) => {
      if (ref.current) ref.current.textContent = formatValue(latest) + suffix;
    });
    return () => unsubscribe();
  }, [springValue, formatValue, suffix]);

  return <span className={className} ref={ref} />;
}
