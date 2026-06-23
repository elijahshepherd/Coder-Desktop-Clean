interface ShimmerTextProps {
  text: string;
}

export function ShimmerText({ text }: ShimmerTextProps) {
  return <div className="shimmer-text">{text}</div>;
}
