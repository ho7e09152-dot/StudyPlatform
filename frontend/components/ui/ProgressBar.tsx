export function ProgressBar({
  value,
  color,
  label,
}: {
  value: number;
  color?: string;
  label?: string;
}) {
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-label={label}
    >
      <span
        className="progress-value"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }}
      />
    </div>
  );
}
