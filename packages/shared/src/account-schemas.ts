import { z } from 'zod';
import { GOALS, LEVELS, MOTIVATION_LEVELS, SCHEDULE_MODES, THEME_MODES, WEIGHT_UNITS, WORKOUT_MODES } from './enums';

/** Passwortregeln – identisch in App und API. */
export const PASSWORD_RULES = [
  { id: 'length', label: 'Mindestens 8 Zeichen', test: (p: string) => p.length >= 8 },
  { id: 'letter', label: 'Mindestens ein Buchstabe', test: (p: string) => /\p{L}/u.test(p) },
  { id: 'digit', label: 'Mindestens eine Zahl', test: (p: string) => /\d/.test(p) },
] as const;

export const passwordSchema = z
  .string()
  .max(128, 'Das Passwort darf höchstens 128 Zeichen lang sein.')
  .refine((p) => PASSWORD_RULES.every((r) => r.test(p)), {
    message: 'Das Passwort erfüllt die Anforderungen nicht (mind. 8 Zeichen, Buchstabe und Zahl).',
  });

export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Der Benutzername muss mindestens 3 Zeichen lang sein.')
  .max(30, 'Der Benutzername darf höchstens 30 Zeichen lang sein.')
  .regex(/^[a-zA-Z0-9_.-]+$/, 'Erlaubt sind Buchstaben (ohne Umlaute), Zahlen, Punkt, Unterstrich und Bindestrich.');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .email('Bitte gib eine gültige E-Mail-Adresse ein.');

export const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  rememberMe: z.boolean().optional().default(true),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Bitte E-Mail oder Benutzernamen eingeben.').max(254),
  password: z.string().min(1, 'Bitte Passwort eingeben.').max(128),
  rememberMe: z.boolean().optional().default(false),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ token: z.string().min(20).max(200), password: passwordSchema });
export const verifyEmailSchema = z.object({ token: z.string().min(20).max(200) });
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});
export const deleteAccountSchema = z.object({
  password: z.string().min(1).max(128),
  confirm: z.literal('LÖSCHEN', { message: 'Bitte zur Bestätigung LÖSCHEN eingeben.' }),
});
export const changeEmailSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });

export const profileUpdateSchema = z
  .object({
    displayName: z.string().trim().max(60).nullable(),
    username: usernameSchema,
    goal: z.enum(GOALS).nullable(),
    level: z.enum(LEVELS).nullable(),
    trainingDaysPerWeek: z.number().int().min(0).max(7).nullable(),
    heightCm: z.number().min(50).max(260).nullable(),
    bodyWeightKg: z.number().min(20).max(400).nullable(),
    targetWeightKg: z.number().min(20).max(400).nullable(),
    activePlanId: z.string().uuid().nullable(),
  })
  .partial();
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

export const settingsUpdateSchema = z
  .object({
    unit: z.enum(WEIGHT_UNITS),
    defaultRestSeconds: z.number().int().min(0).max(1800),
    autoStartRestTimer: z.boolean(),
    weightStepsKg: z.array(z.number().positive().max(50)).min(1).max(8),
    motivationLevel: z.enum(MOTIVATION_LEVELS),
    theme: z.enum(THEME_MODES),
    language: z.enum(['de', 'en']),
    timeZone: z.string().min(1).max(64),
    soundEnabled: z.boolean(),
    vibrationEnabled: z.boolean(),
    notificationsEnabled: z.boolean(),
    progressionEnabled: z.boolean(),
    gamificationEnabled: z.boolean(),
    workoutMode: z.enum(WORKOUT_MODES),
    allowFriendRequests: z.boolean(),
    shareActivityWithFriends: z.boolean(),
  })
  .partial();
export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;

export const onboardingSchema = z.object({
  goal: z.enum(GOALS),
  level: z.enum(LEVELS),
  trainingDaysPerWeek: z.number().int().min(0).max(7),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const bodyWeightEntrySchema = z.object({
  measuredAt: z.string().datetime({ offset: true }),
  weightKg: z.number().min(20).max(400).nullable(),
  bodyFatPct: z.number().min(2).max(70).nullable().optional(),
  measurements: z
    .object({
      waistCm: z.number().min(20).max(300).nullable().optional(),
      chestCm: z.number().min(20).max(300).nullable().optional(),
      armCm: z.number().min(10).max(100).nullable().optional(),
      thighCm: z.number().min(10).max(150).nullable().optional(),
      hipCm: z.number().min(20).max(300).nullable().optional(),
    })
    .nullable()
    .optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});
export type BodyWeightEntryInput = z.infer<typeof bodyWeightEntrySchema>;

export const userExerciseSettingsSchema = z
  .object({
    weightStepKg: z.number().positive().max(50).nullable(),
    defaultWeightKg: z.number().min(0).max(2000).nullable(),
    defaultReps: z.number().int().min(0).max(1000).nullable(),
    defaultRestSeconds: z.number().int().min(0).max(1800).nullable(),
    equipmentSettings: z.string().trim().max(300).nullable(),
    notes: z.string().trim().max(2000).nullable(),
  })
  .partial();
export type UserExerciseSettingsInput = z.infer<typeof userExerciseSettingsSchema>;

export const scheduleUpdateSchema = z
  .object({
    mode: z.enum(SCHEDULE_MODES),
    paused: z.boolean(),
    nextDayIndex: z.number().int().min(0).max(50),
    overrides: z.record(z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.string().uuid().nullable()),
    weekdays: z.record(z.string().uuid(), z.number().int().min(1).max(7).nullable()),
  })
  .partial();
export type ScheduleUpdateInput = z.infer<typeof scheduleUpdateSchema>;
