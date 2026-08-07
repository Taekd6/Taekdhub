export type Subject = "Mathématiques" | "Physique" | "Informatique" | "Français" | "Anglais";
export type ExerciseStatus = "à faire" | "en cours" | "terminé";
export type Difficulty = 1 | 2 | 3 | 4 | 5;
export interface WorkSession { id: string; subject: Subject; started_at: string; ended_at: string | null; duration_seconds: number; note: string | null; }
export interface Exercise { id: string; subject: Subject; chapter: string; source: string; difficulty: Difficulty; status: ExerciseStatus; duration_minutes: number; note: string | null; created_at: string; tags?: string[]; favorite?: boolean; archived?: boolean; hints?: string[]; correction?: string | null; last_opened_at?: string | null; }
