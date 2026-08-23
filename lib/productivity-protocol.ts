import { normalizeAppleProductivityPayload, type AppleProductivityPayload } from "@/lib/apple-productivity-bridge";
import type { CalendarEvent, ProductivityTask } from "@/lib/productivity-engine";

export const PRODUCTIVITY_SCHEMA_VERSION = "1.0";
export interface ProductivitySyncRequest extends AppleProductivityPayload { schemaVersion?: string; source?: string; generatedAt?: string; timestamp?: string; timezone?: string; events?: AppleProductivityPayload["calendarEvents"]; }
export interface ProductivitySyncInput { schemaVersion: string; source: string; generatedAt: string; timezone: string; events: CalendarEvent[]; tasks: ProductivityTask[]; }

function validTimezone(value: unknown): value is string { try { return typeof value === "string" && Boolean(new Intl.DateTimeFormat("en-US", { timeZone: value })); } catch { return false; } }
function object(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }

/** Validates the transport envelope while deliberately dropping malformed provider items during normalization. */
export function normalizeProductivitySyncRequest(value: unknown): ProductivitySyncInput {
  if (!object(value)) throw new Error("Payload must be a JSON object");
  if (value.schemaVersion !== undefined && value.schemaVersion !== PRODUCTIVITY_SCHEMA_VERSION) throw new Error("Unsupported schemaVersion");
  const generatedAt = typeof value.generatedAt === "string" ? value.generatedAt : typeof value.timestamp === "string" ? value.timestamp : new Date().toISOString();
  if (!Number.isFinite(new Date(generatedAt).getTime())) throw new Error("Invalid generatedAt timestamp");
  const normalized = normalizeAppleProductivityPayload({ calendarEvents: Array.isArray(value.calendarEvents) ? value.calendarEvents : Array.isArray(value.events) ? value.events : undefined, reminders: Array.isArray(value.reminders) ? value.reminders : undefined });
  return { schemaVersion: PRODUCTIVITY_SCHEMA_VERSION, source: typeof value.source === "string" && value.source.trim() ? value.source : "apple-shortcuts", generatedAt: new Date(generatedAt).toISOString(), timezone: validTimezone(value.timezone) ? value.timezone : "Europe/Paris", ...normalized };
}
