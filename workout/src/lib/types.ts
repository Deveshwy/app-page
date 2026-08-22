export type SetEntry = {
  reps: number;
  weight: number | null;
};

export type ExerciseLog = {
  id: string;
  name: string;
  sets: SetEntry[];
};

export type Workout = {
  date: string;
  exercises: ExerciseLog[];
};

export type Exercise = {
  id: string;
  name: string;
  group: string;
  image: string | null;
  cue: string;
  aliases: string[];
};

export type DayActivity = {
  date: string;
  reps: number;
  volume: number;
};

export type ProgressPoint = {
  date: string;
  reps: number;
  volume: number;
  topSet: number;
  weight: number | null;
};

export type Goal = {
  exerciseId: string;
  lastLabel: string;
  targetLabel: string;
  why: string;
  sets: number;
  reps: number;
  weight: number | null;
};

export type CoachResult = {
  source: "luna" | "rules";
  headline: string;
  goals: Goal[];
};

export type AppState = {
  exercises: Exercise[];
  today: Workout;
  activity: DayActivity[];
  progress: Record<string, ProgressPoint[]>;
  lastByExercise: Record<string, { date: string; log: ExerciseLog }>;
};
