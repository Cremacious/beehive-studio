// app/[locale]/(app)/community/_components/sparkline.tsx
// Pure presentational SVG polyline. NOT a client component (no hooks).

type Props = {
  values: number[];           // 7 elements (or any length)
  width?: number;
  height?: number;
  stroke?: string;
};

export function Sparkline({ values, width = 64, height = 28, stroke = 'var(--brand)' }: Props) {
  if (values.length === 0 || values.every((v) => v === 0)) {
    // Render a flat line on empty/zero data
    const y = height / 2;
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <line x1={0} y1={y} x2={width} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth={1.5} />
      </svg>
    );
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = width / Math.max(values.length - 1, 1);
  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * (height - 2) - 1;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <polyline fill="none" stroke={stroke} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" points={points} />
    </svg>
  );
}
