export function ImagePlaceholder({
  size,
  className,
}: {
  size: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      className={className}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
    >
      <rect width="32" height="32" rx="8" fill="#e8eee0" />
      <rect x="8" y="11" width="16" height="1.5" rx="0.75" fill="#8c9b83" />
      <rect x="8" y="15.25" width="11" height="1.5" rx="0.75" fill="#8c9b83" />
      <rect x="8" y="19.5" width="16" height="1.5" rx="0.75" fill="#8c9b83" />
    </svg>
  );
}
