// Adapted from React Bits (https://reactbits.dev) — TextAnimations/ShinyText.
// Swapped the `motion/react` import for `framer-motion`; the one-line CSS
// rule the original ships as a separate file is inlined via style instead.
import { useState, useCallback } from "react";
import { motion, useMotionValue, useAnimationFrame, useTransform } from "framer-motion";
import { useRef } from "react";

export default function ShinyText({
  text,
  disabled = false,
  speed = 2.4,
  className = "",
  color = "var(--color-ink-faint)",
  shineColor = "var(--color-model1)",
  spread = 120,
  pauseOnHover = false,
}) {
  const [isPaused, setIsPaused] = useState(false);
  const progress = useMotionValue(0);
  const elapsedRef = useRef(0);
  const lastTimeRef = useRef(null);

  const animationDuration = speed * 1000;

  useAnimationFrame((time) => {
    if (disabled || isPaused) {
      lastTimeRef.current = null;
      return;
    }
    if (lastTimeRef.current === null) {
      lastTimeRef.current = time;
      return;
    }
    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;
    elapsedRef.current += deltaTime;

    const cycleTime = elapsedRef.current % animationDuration;
    progress.set((cycleTime / animationDuration) * 100);
  });

  const backgroundPosition = useTransform(progress, (p) => `${150 - p * 2}% center`);

  const handleMouseEnter = useCallback(() => pauseOnHover && setIsPaused(true), [pauseOnHover]);
  const handleMouseLeave = useCallback(() => pauseOnHover && setIsPaused(false), [pauseOnHover]);

  const gradientStyle = {
    backgroundImage: `linear-gradient(${spread}deg, ${color} 0%, ${color} 35%, ${shineColor} 50%, ${color} 65%, ${color} 100%)`,
    backgroundSize: "200% auto",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    WebkitTextFillColor: "transparent",
    display: "inline-block",
  };

  return (
    <motion.span
      className={className}
      style={{ ...gradientStyle, backgroundPosition }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {text}
    </motion.span>
  );
}
