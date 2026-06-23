import type { CSSProperties } from "react";
import darkLogo from "../assets/brand/coder-logo-dark.png";
import lightLogo from "../assets/brand/coder-logo-light.png";

interface CoderMarkProps {
  className?: string;
  size?: number;
}

export function CoderMark({ className, size = 24 }: CoderMarkProps) {
  return (
    <span
      className={className ? `coder-mark ${className}` : "coder-mark"}
      style={{ "--coder-mark-size": `${size}px`, width: size, height: size } as CSSProperties}
      aria-hidden="true"
    >
      <img className="coder-mark-image coder-mark-image-dark" src={darkLogo} alt="" draggable={false} />
      <img className="coder-mark-image coder-mark-image-light" src={lightLogo} alt="" draggable={false} />
    </span>
  );
}
