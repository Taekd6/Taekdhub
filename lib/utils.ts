export function formatDuration(seconds: number) { const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); const s = seconds % 60; return h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m}:${String(s).padStart(2, "0")}`; }
export function formatMinutes(minutes: number) { return formatDuration(minutes * 60); }
