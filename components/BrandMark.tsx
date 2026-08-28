export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className="brand-mark"
    >
      <path d="M0 0h32v32H0z" fill="currentColor" />
      <path d="M7 7h5l8 10V7h5v18h-5l-8-10v10H7z" fill="#ffffff" />
    </svg>
  );
}
