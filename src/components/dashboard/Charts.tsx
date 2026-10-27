"use client";

import { useEffect, useRef, useState } from "react";

// Lightweight SVG charts (no chart library). One series per chart, one y-axis,
// thin marks, recessive grid, crosshair/hover tooltips, keyboard-focusable.

export type Point = { label: string; value: number };

const compact = (n: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function niceTicks(min: number, max: number, count = 4) {
  if (max === min) max = min + 1;
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

const H = 220;
const PAD = { top: 12, right: 12, bottom: 28, left: 44 };

function Axes({ width, ticks, y, labels, x }: { width: number; ticks: number[]; y: (v: number) => number; labels: Point[]; x: (i: number) => number }) {
  // Fit labels to the width (~1 label per 70px) so they never collide on phones.
  const every = Math.max(1, Math.ceil(labels.length / Math.max(2, Math.floor((width - PAD.left - PAD.right) / 70))));
  return (
    <g fontSize="11" className="fill-muted">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className="stroke-line" strokeWidth={t === 0 ? 1.5 : 1} />
          <text x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle">
            {compact(t)}
          </text>
        </g>
      ))}
      {labels.map((p, i) =>
        i % every === 0 ? (
          <text key={p.label} x={x(i)} y={H - 8} textAnchor="middle">
            {p.label}
          </text>
        ) : null,
      )}
    </g>
  );
}

function Tooltip({ left, top, value, label, unit }: { left: number; top: number; value: number; label: string; unit: string }) {
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-md"
      style={{ left, top: top - 8 }}
    >
      <div className="font-mono text-sm font-semibold text-ink">{value.toLocaleString("en")}</div>
      <div className="text-muted">
        {unit} · {label}
      </div>
    </div>
  );
}

export function LineChart({ data, unit, ariaLabel }: { data: Point[]; unit: string; ariaLabel: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const ticks = niceTicks(0, Math.max(...data.map((d) => d.value), 1));
  const maxT = ticks[ticks.length - 1];
  const innerW = Math.max(width - PAD.left - PAD.right, 1);
  const x = (i: number) => PAD.left + (data.length > 1 ? (i / (data.length - 1)) * innerW : innerW / 2);
  const y = (v: number) => PAD.top + (1 - v / maxT) * (H - PAD.top - PAD.bottom);
  const path = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const area = `${path} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;

  function onMove(clientX: number, rect: DOMRect) {
    const i = Math.round(((clientX - rect.left - PAD.left) / innerW) * (data.length - 1));
    setHover(Math.min(Math.max(i, 0), data.length - 1));
  }

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg
          width={width}
          height={H}
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          onPointerMove={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerLeave={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") setHover((h) => Math.min((h ?? -1) + 1, data.length - 1));
            if (e.key === "ArrowLeft") setHover((h) => Math.max((h ?? data.length) - 1, 0));
          }}
          onBlur={() => setHover(null)}
          className="touch-none outline-none"
        >
          <Axes width={width} ticks={ticks} y={y} labels={data} x={x} />
          <path d={area} fill="var(--chart)" opacity={0.08} />
          <path d={path} fill="none" stroke="var(--chart)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {hover != null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={y(0)} className="stroke-muted" strokeWidth={1} strokeDasharray="3 3" />
              <circle cx={x(hover)} cy={y(data[hover].value)} r={5} fill="var(--chart)" stroke="var(--surface)" strokeWidth={2} />
            </g>
          )}
        </svg>
      )}
      {hover != null && width > 0 && (
        <Tooltip left={x(hover)} top={y(data[hover].value)} value={data[hover].value} label={data[hover].label} unit={unit} />
      )}
    </div>
  );
}

export function BarChart({ data, unit, ariaLabel }: { data: Point[]; unit: string; ariaLabel: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const min = Math.min(0, ...data.map((d) => d.value));
  const max = Math.max(1, ...data.map((d) => d.value));
  const ticks = niceTicks(min, max);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const innerW = Math.max(width - PAD.left - PAD.right, 1);
  const slot = innerW / Math.max(data.length, 1);
  const gap = Math.min(2, slot * 0.25);
  const barW = Math.max(slot - gap, 1);
  const x = (i: number) => PAD.left + i * slot + slot / 2;
  const y = (v: number) => PAD.top + ((hi - v) / (hi - lo)) * (H - PAD.top - PAD.bottom);
  const r = Math.min(4, barW / 2);

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg width={width} height={H} role="img" aria-label={ariaLabel} onPointerLeave={() => setHover(null)} className="touch-none">
          <Axes width={width} ticks={ticks} y={y} labels={data} x={x} />
          {data.map((d, i) => {
            const top = y(Math.max(d.value, 0));
            const bottom = y(Math.min(d.value, 0));
            const h = Math.max(bottom - top, d.value === 0 ? 0 : 1);
            const left = x(i) - barW / 2;
            // Rounded data-end, square at the baseline.
            const path =
              d.value >= 0
                ? `M${left},${bottom} V${top + r} Q${left},${top} ${left + r},${top} H${left + barW - r} Q${left + barW},${top} ${left + barW},${top + r} V${bottom} Z`
                : `M${left},${top} V${bottom - r} Q${left},${bottom} ${left + r},${bottom} H${left + barW - r} Q${left + barW},${bottom} ${left + barW},${bottom - r} V${top} Z`;
            return (
              <g key={d.label}>
                {h > 0 && <path d={path} fill="var(--chart)" opacity={hover == null || hover === i ? 1 : 0.55} />}
                <rect
                  x={PAD.left + i * slot}
                  y={PAD.top}
                  width={slot}
                  height={H - PAD.top - PAD.bottom}
                  fill="transparent"
                  tabIndex={-1}
                  onPointerEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                />
              </g>
            );
          })}
        </svg>
      )}
      {hover != null && width > 0 && (
        <Tooltip left={x(hover)} top={y(Math.max(data[hover].value, 0))} value={data[hover].value} label={data[hover].label} unit={unit} />
      )}
    </div>
  );
}

// Horizontal share bars for categorical breakdowns (traffic, countries, devices).
export function ShareList({ rows }: { rows: { label: string; value: number }[] }) {
  const total = rows.reduce((a, r) => a + r.value, 0) || 1;
  const max = Math.max(...rows.map((r) => r.value), 1);
  if (!rows.length) return <p className="text-sm text-muted">No data for this period.</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="mb-1 flex justify-between gap-3">
            <span>{r.label}</span>
            <span className="font-mono text-xs text-muted">
              {compact(r.value)} · {Math.round((r.value / total) * 100)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: "var(--chart)" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
