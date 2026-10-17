import type {
  AchievementView,
  AnalyticsOverview,
  BodyWeightEntryView,
  ExerciseListItem,
  ExercisePerformance,
  ExerciseProgressPoint,
  ExerciseView,
  FriendCodeView,
  FriendsOverview,
  InviteListItem,
  InviteLiveView,
  InviteView,
  MetaView,
  MuscleGroupStat,
  PersonalRecordView,
  PlanSummaryView,
  PlanView,
  SettingsUpdateInput,
  TodayView,
  UserView,
  WeeklyPoint,
  WorkoutSessionView,
  WorkoutSummaryView,
  WorkoutTemplate,
} from '@satzio/shared';
import { EXERCISES } from '@satzio/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api } from './api';
import { useAuth } from './auth';
import { todayKey } from './format';

export const qk = {
  meta: ['meta'] as const,
  today: ['today'] as const,
  plans: (archived = false) => ['plans', archived] as const,
  plan: (id: string) => ['plan', id] as const,
  templates: ['templates'] as const,
  exercises: ['exercises'] as const,
  exercise: (id: string) => ['exercise', id] as const,
  exerciseHistory: (id: string) => ['exercise-history', id] as const,
  performance: ['performance'] as const,
  history: (q: string) => ['history', q] as const,
  workout: (id: string) => ['workout', id] as const,
  records: ['records'] as const,
  achievements: ['achievements'] as const,
  body: ['body'] as const,
  analytics: (kind: string, range: string, id?: string) => ['analytics', kind, range, id ?? ''] as const,
  sessions: ['sessions'] as const,
};

export function useMeta() {
  return useQuery({ queryKey: qk.meta, queryFn: () => api<MetaView>('/meta'), staleTime: 5 * 60_000 });
}

export function useToday() {
  return useQuery({ queryKey: qk.today, queryFn: () => api<TodayView>(`/today?date=${todayKey()}`) });
}

export function usePlans(archived = false) {
  return useQuery({ queryKey: qk.plans(archived), queryFn: () => api<PlanSummaryView[]>(`/plans${archived ? '?archived=true' : ''}`) });
}

export function usePlan(id: string | undefined) {
  return useQuery({ queryKey: qk.plan(id ?? ''), queryFn: () => api<PlanView>(`/plans/${id}`), enabled: !!id });
}

export function useTemplates() {
  return useQuery({ queryKey: qk.templates, queryFn: () => api<WorkoutTemplate[]>('/plans/templates'), staleTime: Infinity });
}

export function useExerciseList() {
  return useQuery({ queryKey: qk.exercises, queryFn: () => api<ExerciseListItem[]>('/exercises'), staleTime: 10 * 60_000 });
}

/** Map id → Übung für schnelle Zugriffe. */
export function useExerciseMap() {
  const { data } = useExerciseList();
  return useMemo(() => new Map((data ?? []).map((e) => [e.id, e])), [data]);
}

const seedBySlug = new Map(EXERCISES.map((e) => [e.slug, e]));

/** Übungsdetails; offline Fallback auf die mitgelieferte Bibliothek. */
export function useExerciseDetail(id: string | undefined) {
  const list = useExerciseMap();
  return useQuery({
    queryKey: qk.exercise(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      try {
        return await api<ExerciseView>(`/exercises/${id}`);
      } catch (e) {
        const item = list.get(id!);
        const seed = item ? seedBySlug.get(item.slug) : undefined;
        if (item && seed) {
          return {
            ...item,
            descriptionDe: seed.descriptionDe,
            stepsDe: seed.stepsDe,
            mistakesDe: seed.mistakesDe,
            safetyDe: seed.safetyDe ?? null,
            alternatives: seed.alternatives,
            media: [],
            userSettings: null,
          } satisfies ExerciseView;
        }
        throw e;
      }
    },
  });
}

export function usePerformance() {
  const q = useQuery({ queryKey: qk.performance, queryFn: () => api<ExercisePerformance[]>('/exercises/performance'), staleTime: 60_000 });
  const map = useMemo(() => new Map((q.data ?? []).map((p) => [p.exerciseId, p])), [q.data]);
  return { ...q, map };
}

export function useHistory(params: Record<string, string | undefined> = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  return useQuery({ queryKey: qk.history(qs), queryFn: () => api<WorkoutSummaryView[]>(`/workouts${qs ? `?${qs}` : ''}`) });
}

export function useRecords() {
  return useQuery({ queryKey: qk.records, queryFn: () => api<PersonalRecordView[]>('/records') });
}

export function useAchievements() {
  return useQuery({ queryKey: qk.achievements, queryFn: () => api<AchievementView[]>('/achievements') });
}

export function useBodyWeight() {
  return useQuery({ queryKey: qk.body, queryFn: () => api<BodyWeightEntryView[]>('/body-weight') });
}

export function useAnalyticsOverview(range: string) {
  return useQuery({ queryKey: qk.analytics('overview', range), queryFn: () => api<AnalyticsOverview>(`/analytics/overview?range=${range}`) });
}
export function useWeekly(range: string) {
  return useQuery({ queryKey: qk.analytics('weekly', range), queryFn: () => api<WeeklyPoint[]>(`/analytics/weekly?range=${range}`) });
}
export function useTrainedExercises() {
  return useQuery({
    queryKey: qk.analytics('exercises', 'all'),
    queryFn: () => api<{ exerciseId: string; name: string; sessions: number; lastTrained: string }[]>('/analytics/exercises'),
  });
}
export function useExerciseProgress(id: string | undefined, range: string) {
  return useQuery({
    queryKey: qk.analytics('exercise', range, id),
    enabled: !!id,
    queryFn: () => api<ExerciseProgressPoint[]>(`/analytics/exercises/${id}?range=${range}`),
  });
}
export function useMuscles(range: string) {
  return useQuery({ queryKey: qk.analytics('muscles', range), queryFn: () => api<MuscleGroupStat[]>(`/analytics/muscles?range=${range}`) });
}
export function useCalendar(month: string) {
  return useQuery({
    queryKey: qk.analytics('calendar', month),
    queryFn: () => api<{ id: string; name: string; date: string }[]>(`/analytics/calendar?month=${month}`),
  });
}

export function useWorkoutRemote(id: string | undefined) {
  return useQuery({ queryKey: qk.workout(id ?? ''), enabled: !!id, queryFn: () => api<WorkoutSessionView>(`/workouts/${id}`) });
}

/** Einstellungen sofort speichern (optimistisch). */
export function useUpdateSettings() {
  const setUser = useAuth((s) => s.setUser);
  const user = useAuth((s) => s.user);
  return useMutation({
    mutationFn: (patch: SettingsUpdateInput) => api<UserView>('/users/me/settings', { method: 'PATCH', body: patch }),
    onMutate: (patch) => {
      if (user) setUser({ ...user, settings: { ...user.settings, ...patch } as UserView['settings'] });
      return { prev: user };
    },
    onError: (_e, _p, ctx) => {
      if (ctx?.prev) setUser(ctx.prev);
    },
    onSuccess: (u) => setUser(u),
  });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: readonly unknown[][]) => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: k })));
}

/* ───────────────────────────── Soziales: Freunde & gemeinsames Training ───────────────────────────── */

export const socialKeys = {
  friends: ['friends'] as const,
  friendCode: ['friend-code'] as const,
  invites: ['invites'] as const,
  invite: (id: string) => ['invite', id] as const,
  live: (id: string) => ['invite-live', id] as const,
  forSession: (sessionId: string) => ['invite-for-session', sessionId] as const,
  join: (token: string) => ['invite-join', token] as const,
};

export function useFriends() {
  return useQuery({ queryKey: socialKeys.friends, queryFn: () => api<FriendsOverview>('/friends'), staleTime: 10_000, refetchOnMount: 'always' });
}

export function useFriendCode(enabled = true) {
  return useQuery({ queryKey: socialKeys.friendCode, queryFn: () => api<FriendCodeView>('/friends/code'), enabled, staleTime: Infinity });
}

export function useInvites() {
  return useQuery({ queryKey: socialKeys.invites, queryFn: () => api<InviteListItem[]>('/invites'), staleTime: 10_000, refetchOnMount: 'always' });
}

export function useInvite(id: string | undefined) {
  return useQuery({ queryKey: socialKeys.invite(id ?? ''), enabled: !!id, queryFn: () => api<InviteView>(`/invites/${id}`) });
}

/** Live-Fortschritt der Gruppe – alle 5 s, nur solange die Seite sichtbar ist. */
export function useInviteLive(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: socialKeys.live(id ?? ''),
    enabled: !!id && enabled,
    queryFn: () => api<InviteLiveView>(`/invites/${id}/live`),
    refetchInterval: (q) => (q.state.error ? false : 5_000),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 2_000,
    retry: false,
  });
}
