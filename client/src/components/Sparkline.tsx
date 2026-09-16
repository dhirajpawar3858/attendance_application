// Tiny inline sparkline (bars) coloured by the current metric colour.
export function Sparkline({
  data,
  color,
  height = 30,
}: {
  data: number[];
  color: string;
  height?: number;
}) {
  const max = Math.max(1, ...data);
  return (
    <div className="spark" style={{ height }}>
      {data.map((v, i) => (
        <i
          key={i}
          style={{
            height: `${Math.max(8, (v / max) * 100)}%`,
            background: color,
            opacity: i === data.length - 1 ? 1 : 0.35,
          }}
        />
      ))}
    </div>
  );
}
