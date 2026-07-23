import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import darkLogo from "../assets/brand/coder-logo-dark.png";
import lightLogo from "../assets/brand/coder-logo-light.png";

interface CoderMarkProps {
  className?: string;
  size?: number;
  followSystemTheme?: boolean;
}

export function CoderMark({ className, size = 24, followSystemTheme = true }: CoderMarkProps) {
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (!followSystemTheme) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemTheme(mediaQuery.matches ? "dark" : "light");

    const handler = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [followSystemTheme]);

  const isDarkMode = followSystemTheme ? systemTheme === "dark" : document.documentElement.classList.contains("theme-dark");

  return (
    <span
      className={className ? `coder-mark ${className}` : "coder-mark"}
      style={{ "--coder-mark-size": `${size}px`, width: size, height: size } as CSSProperties}
      aria-hidden="true"
    >
      <img
        className={`coder-mark-image ${isDarkMode ? "coder-mark-image-light" : "coder-mark-image-dark"}`}
        src={isDarkMode ? lightLogo : darkLogo}
        alt=""
        draggable={false}
      />
    </span>
  );
}
