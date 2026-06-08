export interface StatStripCell {
  value: string | number;
  label: string;
}

interface StatStripProps {
  cells: StatStripCell[];
}

export function StatStrip({ cells }: StatStripProps) {
  return (
    <div className="stat-strip">
      {cells.map((cell, i) => (
        <div className="ss" key={`${cell.label}-${i}`}>
          <div className="v">{cell.value}</div>
          <div className="l">{cell.label}</div>
        </div>
      ))}
    </div>
  );
}
