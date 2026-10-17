/**
 * ACHIEVEMENTS – zurückhaltend, automatisch erkannt, abschaltbar.
 * Die Definitionen werden als Seed-Daten in die Datenbank übernommen.
 */
export interface AchievementStats {
  workoutCount: number;
  prCount: number;
  weeksGoalReached: number;
  longestWeeklyStreak: number;
  /** true, wenn das zuletzt abgeschlossene Training ein neues Rekordvolumen hatte (ab dem 2. Training). */
  newMaxSessionVolume: boolean;
  totalVolumeKg: number;
}

export interface AchievementDefinition {
  code: string;
  title: string;
  description: string;
  icon: string;
  check: (s: AchievementStats) => boolean;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  { code: 'first_workout', title: 'Erstes Workout', description: 'Dein erstes Training abgeschlossen.', icon: 'flag', check: (s) => s.workoutCount >= 1 },
  { code: 'workouts_10', title: 'Zehn Workouts', description: '10 Trainings abgeschlossen.', icon: 'dumbbell', check: (s) => s.workoutCount >= 10 },
  { code: 'workouts_50', title: 'Fünfzig Workouts', description: '50 Trainings abgeschlossen.', icon: 'medal', check: (s) => s.workoutCount >= 50 },
  { code: 'workouts_100', title: 'Hundert Workouts', description: '100 Trainings abgeschlossen.', icon: 'trophy', check: (s) => s.workoutCount >= 100 },
  { code: 'first_pr', title: 'Erster Rekord', description: 'Deinen ersten persönlichen Rekord aufgestellt.', icon: 'zap', check: (s) => s.prCount >= 1 },
  { code: 'prs_10', title: 'Rekordjäger', description: '10 persönliche Rekorde aufgestellt.', icon: 'flame', check: (s) => s.prCount >= 10 },
  { code: 'first_week', title: 'Wochenziel erreicht', description: 'Eine komplette Trainingswoche wie geplant absolviert.', icon: 'calendar-check', check: (s) => s.weeksGoalReached >= 1 },
  { code: 'streak_4', title: 'Vier Wochen am Stück', description: 'Vier Wochen in Folge dein Wochenziel erreicht.', icon: 'repeat', check: (s) => s.longestWeeklyStreak >= 4 },
  { code: 'max_volume', title: 'Neues Volumen-Hoch', description: 'Ein Training mit neuem maximalem Trainingsvolumen.', icon: 'trending-up', check: (s) => s.newMaxSessionVolume },
  { code: 'volume_100t', title: '100 Tonnen', description: 'Insgesamt 100.000 kg Trainingsvolumen bewegt.', icon: 'weight', check: (s) => s.totalVolumeKg >= 100000 },
];

export function evaluateAchievements(stats: AchievementStats, alreadyUnlocked: Set<string>): string[] {
  return ACHIEVEMENTS.filter((a) => !alreadyUnlocked.has(a.code) && a.check(stats)).map((a) => a.code);
}
