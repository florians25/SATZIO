import { Award, Calendar, CalendarCheck, Dumbbell, Flag, Flame, Lock, Medal, Repeat, TrendingUp, Trophy, Weight, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { PageHeader } from '@/components/PageHeader';
import { Card, Skeleton } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { fmtDate } from '@/lib/format';
import { useAchievements } from '@/lib/queries';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  flag: Flag,
  dumbbell: Dumbbell,
  medal: Medal,
  trophy: Trophy,
  zap: Zap,
  flame: Flame,
  'calendar-check': CalendarCheck,
  repeat: Repeat,
  'trending-up': TrendingUp,
  weight: Weight,
  calendar: Calendar,
};

export default function AchievementsPage() {
  const q = useAchievements();
  return (
    <div>
      <PageHeader title="Erfolge" back="/profile" subtitle="Abschaltbar in den Einstellungen" />
      <div className="grid grid-cols-2 gap-2 px-4 pb-10">
        {q.isLoading && <Skeleton className="col-span-2 h-40" />}
        {q.data?.map((a, i) => {
          const Icon = ICONS[a.icon] ?? Award;
          const unlocked = !!a.unlockedAt;
          return (
            <motion.div key={a.code} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Card className={cn('h-full p-4', !unlocked && 'opacity-50')}>
                <span className={cn('grid h-11 w-11 place-items-center rounded-2xl', unlocked ? 'bg-primary text-primary-fg' : 'bg-surface-2 text-muted')}>
                  {unlocked ? <Icon className="h-6 w-6" /> : <Lock className="h-5 w-5" />}
                </span>
                <p className="mt-3 font-semibold">{a.title}</p>
                <p className="text-sm text-muted">{a.description}</p>
                {a.unlockedAt && <p className="mt-1 text-xs text-primary">{fmtDate(a.unlockedAt)}</p>}
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
