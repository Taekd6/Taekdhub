"use client";

import { useEffect, useId as useReactId, useState } from "react";
import type { WeekPoint } from "@/lib/exos";

/**
 * Les quatre graphiques de l'écran Exos, en SVG dessiné à la main (aucune
 * bibliothèque) : anneau de maîtrise, anneau des statuts, courbe de
 * progression, radar des chapitres, prévision des révisions. Animations en
 * CSS (components/exos/exos.css), coupées si l'élève réduit les animations.
 */

const fr = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;
/** Un identifiant sûr dans url(#…) : React 19 en produit avec « » ou « : », que WebKit peut refuser. */
function useId(): string {
  return `x${useReactId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

const pct = (value: number) => `${Math.round(value * 100)}%`;
const DOW = ["L", "M", "M", "J", "V", "S", "D"];

export const STATUS_COLOR = { seul: "#28a745", indices: "#5e5ce6", rate: "#ff3b30" } as const;

/** Anneau de maîtrise (part réussie seul, indices comptés pour moitié). */
export function MasteryRing({ value, size = 136 }: { value: number; size?: number }) {
  const id = useId();
  const c = 2 * Math.PI * 58;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return (
    <svg width={size} height={size} viewBox="0 0 140 140" role="img" aria-label={`Maîtrise ${pct(value)}`} style={{ flex: "none" }}>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0a6cff" />
          <stop offset="1" stopColor="#34c759" />
        </linearGradient>
      </defs>
      <circle cx="70" cy="70" r="58" fill="none" stroke="var(--x-cell)" strokeWidth="13" />
      <circle
        className="x-arc"
        cx="70"
        cy="70"
        r="58"
        fill="none"
        stroke={`url(#${id}-g)`}
        strokeWidth="13"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - shown)}
        transform="rotate(-90 70 70)"
      />
      <text x="70" y="75" textAnchor="middle" fontSize="32" fontWeight="800" fill="var(--x-ink)" letterSpacing="-1">
        {pct(value)}
      </text>
      <text x="70" y="95" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--x-muted)">
        réussi seul
      </text>
    </svg>
  );
}

/** Anneau des statuts. */
export function StatusDonut({ seul, indices, rate, size = 126 }: { seul: number; indices: number; rate: number; size?: number }) {
  const total = seul + indices + rate;
  const c = 2 * Math.PI * 52;
  const gap = total > 1 ? 2.2 : 0;
  let offset = 0;
  const arcs = (["seul", "indices", "rate"] as const)
    .map((key) => ({ key, n: { seul, indices, rate }[key] }))
    .filter((arc) => arc.n > 0)
    .map((arc) => {
      const length = (c * arc.n) / total;
      const out = { ...arc, dash: Math.max(length - gap, 0.5), offset: -offset };
      offset += length;
      return out;
    });
  return (
    <svg width={size} height={size} viewBox="0 0 140 140" role="img" aria-label={`${total} cases : ${seul} seul, ${indices} avec indices, ${rate} ratées`} style={{ flex: "none" }}>
      <g transform="rotate(-90 70 70)">
        <circle cx="70" cy="70" r="52" fill="none" stroke="var(--x-cell)" strokeWidth="18" />
        {arcs.map((arc) => (
          <circle key={arc.key} cx="70" cy="70" r="52" fill="none" stroke={STATUS_COLOR[arc.key]} strokeWidth="18" strokeDasharray={`${arc.dash} ${c}`} strokeDashoffset={arc.offset} />
        ))}
      </g>
      <text x="70" y="74" textAnchor="middle" fontSize="28" fontWeight="800" fill="var(--x-ink)">
        {total}
      </text>
      <text x="70" y="92" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--x-muted)">
        cases faites
      </text>
    </svg>
  );
}

/** Courbe de maîtrise (ou de volume) sur 12 semaines, barres d'activité en dessous. */
export function ProgressChart({ points, mode }: { points: WeekPoint[]; mode: "mastery" | "volume" }) {
  const id = useId();
  const W = 560;
  const H = 240;
  const L = 38;
  const R = 14;
  const T = 16;
  const B = 30;
  const cw = W - L - R;
  const ch = H - T - B;
  const n = points.length;
  const x = (k: number) => L + (cw * (k + 0.5)) / n;
  const maxWorked = Math.max(4, ...points.map((p) => p.worked));
  const maxDone = Math.max(4, ...points.map((p) => p.done));
  const value = (p: WeekPoint) => (mode === "mastery" ? p.mastery : p.done ? p.done / maxDone : null);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const series = points.map((p, k) => ({ k, v: value(p) })).filter((p): p is { k: number; v: number } => p.v !== null);
  const P = series.map((p) => [x(p.k), T + ch * (1 - p.v)] as const);
  let d = "";
  if (P.length >= 2) {
    d = `M${P[0][0]},${P[0][1]}`;
    for (let i = 1; i < P.length; i += 1) {
      const [x0, y0] = P[i - 1];
      const [x1, y1] = P[i];
      const mx = (x0 + x1) / 2;
      d += ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`;
    }
  }
  const end = P[P.length - 1];
  const last = series[series.length - 1];
  return (
    <svg className="x-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={mode === "mastery" ? "Maîtrise sur 12 semaines" : "Cases faites sur 12 semaines"}>
      <defs>
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0a6cff" stopOpacity="0.26" />
          <stop offset="1" stopColor="#0a6cff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line className="x-gl" x1={L} x2={W - R} y1={T + ch * (1 - t)} y2={T + ch * (1 - t)} />
          <text className="x-axis" x={L - 8} y={T + ch * (1 - t) + 4} textAnchor="end">
            {mode === "mastery" ? pct(t) : Math.round(t * maxDone)}
          </text>
        </g>
      ))}
      {points.map((p, k) =>
        p.worked ? (
          <rect key={p.start} className="x-grow" style={{ animationDelay: `${k * 30}ms` }} x={x(k) - 9} y={T + ch - Math.max(3, (ch * 0.32 * p.worked) / maxWorked)} width="18" height={Math.max(3, (ch * 0.32 * p.worked) / maxWorked)} rx="5" fill="rgba(10,108,255,.15)">
            <title>{`${p.worked} cases la semaine du ${fr(p.start)}`}</title>
          </rect>
        ) : null
      )}
      {d && (
        <>
          <path className="x-fade" d={`${d} L${end[0]},${T + ch} L${P[0][0]},${T + ch} Z`} fill={`url(#${id}-a)`} />
          <path className="x-draw" pathLength={1} d={d} fill="none" stroke="#0a6cff" strokeWidth="3" strokeLinecap="round" />
          <circle className="x-pop" cx={end[0]} cy={end[1]} r="9" fill="rgba(10,108,255,.18)" />
          <circle className="x-pop" cx={end[0]} cy={end[1]} r="5" fill="var(--x-solid)" stroke="#0a6cff" strokeWidth="3" />
          <text className="x-lbl x-fade" x={end[0] - 12} y={Math.max(T + 12, end[1] - 14)} textAnchor="end">
            {mode === "mastery" ? pct(last.v) : points[last.k].done}
          </text>
        </>
      )}
      {points.map((p, k) =>
        k % 2 === 1 || k === n - 1 ? (
          <text key={p.start} className="x-axis" x={x(k)} y={H - 8} textAnchor="middle">
            {k === n - 1 ? "cette sem." : fr(p.start)}
          </text>
        ) : null
      )}
    </svg>
  );
}

export interface RadarItem {
  label: string;
  value: number;
}

/** Radar de maîtrise par chapitre (3 à 8 axes). */
export function ChapterRadar({ items }: { items: RadarItem[] }) {
  const id = useId();
  if (items.length < 3) {
    return <div className="x-emptyc">Le radar s&apos;affiche dès que tu as coché des cases dans trois chapitres. Il montre d&apos;un coup d&apos;œil où tu es solide et où tu décroches.</div>;
  }
  const cx = 170;
  const cy = 150;
  const r = 100;
  const n = items.length;
  const angle = (k: number) => -Math.PI / 2 + (2 * Math.PI * k) / n;
  const pt = (k: number, v: number) => [cx + r * v * Math.cos(angle(k)), cy + r * v * Math.sin(angle(k))] as const;
  const color = (v: number) => (v >= 0.7 ? "#5fd97c" : v >= 0.45 ? "#6aa4ff" : "#ff8a82");
  return (
    <svg className="x-chart" viewBox="-78 0 496 300" role="img" aria-label="Maîtrise par chapitre">
      <defs>
        <radialGradient id={`${id}-r`}>
          <stop offset="0" stopColor="#5e5ce6" stopOpacity="0.18" />
          <stop offset="1" stopColor="#0a6cff" stopOpacity="0.34" />
        </radialGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((v) => (
        <polygon key={v} points={items.map((_, k) => pt(k, v).join(",")).join(" ")} fill="none" stroke="var(--x-line)" strokeWidth={v === 1 ? 1.5 : 1} />
      ))}
      {items.map((_, k) => {
        const [x2, y2] = pt(k, 1);
        return <line key={k} x1={cx} y1={cy} x2={x2} y2={y2} stroke="var(--x-line)" />;
      })}
      <text className="x-axis" x={cx + 4} y={cy - r * 0.5 + 4}>
        50%
      </text>
      <polygon
        className="x-pop"
        style={{ transformBox: "view-box", transformOrigin: `${cx}px ${cy}px` }}
        points={items.map((item, k) => pt(k, Math.max(0.04, item.value)).join(",")).join(" ")}
        fill={`url(#${id}-r)`}
        stroke="#0a6cff"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {items.map((item, k) => {
        const [px, py] = pt(k, Math.max(0.04, item.value));
        const a = angle(k);
        const lx = cx + (r + 16) * Math.cos(a);
        const ly = cy + (r + 16) * Math.sin(a);
        const cos = Math.cos(a);
        const anchor = Math.abs(cos) < 0.25 ? "middle" : cos > 0 ? "start" : "end";
        const dy = Math.sin(a) > 0.5 ? 12 : Math.sin(a) < -0.5 ? -4 : 4;
        return (
          <g key={item.label}>
            <circle className="x-pop" cx={px} cy={py} r="4.5" fill="var(--x-solid)" stroke={color(item.value)} strokeWidth="2.5" />
            <text x={lx} y={ly + dy - 8} textAnchor={anchor} className="x-lbl" style={{ fontSize: 18 }}>
              {item.label}
            </text>
            <text x={lx} y={ly + dy + 11} textAnchor={anchor} fontSize="16" fontWeight="800" fill={color(item.value)}>
              {pct(item.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Prévision des retours sur 14 jours ; aujourd'hui en plein. */
export function ForecastChart({ days }: { days: { day: string; count: number }[] }) {
  const W = 400;
  const H = 230;
  const L = 10;
  const R = 10;
  const T = 22;
  const B = 34;
  const cw = W - L - R;
  const ch = H - T - B;
  /* L'échelle suit les jours à venir : un gros retard du jour ne doit pas écraser les autres barres (sa barre est plafonnée, son nombre reste exact). */
  const max = Math.max(3, Math.ceil(1.6 * Math.max(0, ...days.slice(1).map((d) => d.count))));
  const bw = cw / days.length;
  return (
    <svg className="x-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Révisions prévues sur 14 jours">
      <line className="x-gl" x1={L} x2={W - R} y1={T + ch} y2={T + ch} />
      {days.map((d, k) => {
        const h = d.count ? Math.min(ch, Math.max(6, (ch * d.count) / max)) : 0;
        const x = L + bw * k + bw * 0.18;
        const w = bw * 0.64;
        const date = new Date(`${d.day}T12:00:00Z`);
        const dow = DOW[(date.getUTCDay() + 6) % 7];
        return (
          <g key={d.day}>
            {h ? (
              <>
                <rect className="x-grow" style={{ animationDelay: `${k * 35}ms` }} x={x} y={T + ch - h} width={w} height={h} rx="7" fill={k === 0 ? "#0a6cff" : "rgba(10,108,255,.24)"}>
                  <title>{`${d.count} le ${fr(d.day)}`}</title>
                </rect>
                <text className={`x-fade ${k === 0 ? "x-lbl" : "x-axis"}`} x={x + w / 2} y={T + ch - h - 6} textAnchor="middle" style={k === 0 ? { fill: "#0a6cff" } : undefined}>
                  {d.count}
                </text>
              </>
            ) : (
              <rect x={x} y={T + ch - 3} width={w} height="3" rx="1.5" fill="var(--x-cell)" />
            )}
            <text className="x-axis" x={x + w / 2} y={H - 16} textAnchor="middle" style={k === 0 ? { fill: "var(--x-ink)" } : undefined}>
              {k === 0 ? "Auj." : dow}
            </text>
            <text className="x-axis" x={x + w / 2} y={H - 3} textAnchor="middle" fontSize="10">
              {date.getUTCDate()}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
