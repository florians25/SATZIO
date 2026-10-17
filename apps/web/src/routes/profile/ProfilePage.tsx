import { GOAL_LABELS_DE, LEVEL_LABELS_DE, type UserView } from '@satzio/shared';
import { Award, Camera, ChevronRight, Database, LogOut, Scale, Settings, Shield, UserCog, Users } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { Badge, Card } from '@/components/ui/card';
import { ListRow } from '@/components/ui/controls';
import { ConfirmSheet } from '@/components/ui/sheet';
import { api, errorMessage } from '@/lib/api';
import { pendingChangesCount, useAuth } from '@/lib/auth';
import { useAchievements, useAnalyticsOverview, useFriends } from '@/lib/queries';
import { EditProfileSheet } from './EditProfileSheet';

export default function ProfilePage() {
  const user = useAuth((s) => s.user)!;
  const setUser = useAuth((s) => s.setUser);
  const logout = useAuth((s) => s.logout);
  const ov = useAnalyticsOverview('all');
  const ach = useAchievements();
  const friends = useFriends();
  const friendRequests = friends.data?.incoming.length ?? 0;
  const fileRef = useRef<HTMLInputElement>(null);
  const [edit, setEdit] = useState(false);
  const [logoutWarn, setLogoutWarn] = useState<number | null>(null);
  const p = user.profile;
  const unlocked = ach.data?.filter((a) => a.unlockedAt).length ?? 0;

  const upload = async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    try {
      setUser(await api<UserView>('/users/me/avatar', { method: 'POST', form }));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const tryLogout = async () => {
    const pending = await pendingChangesCount();
    if (pending > 0) setLogoutWarn(pending);
    else await logout();
  };

  return (
    <div>
      <PageHeader large title="Profil" />
      <div className="space-y-4 px-4 pb-8">
        <Card className="flex items-center gap-4 p-4">
          <button type="button" onClick={() => fileRef.current?.click()} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-surface-2" aria-label="Profilbild ändern">
            {p.avatarUrl ? (
              <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="grid h-full w-full place-items-center text-2xl font-extrabold text-primary">{(p.displayName || user.username).slice(0, 1).toUpperCase()}</span>
            )}
            <span className="absolute bottom-0 right-0 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-fg">
              <Camera className="h-3.5 w-3.5" />
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-extrabold">{p.displayName || user.username}</p>
            <p className="truncate text-sm text-muted">@{user.username}</p>
            <p className="text-sm text-muted">
              {p.goal ? GOAL_LABELS_DE[p.goal] : 'Kein Ziel'} · {p.level ? LEVEL_LABELS_DE[p.level] : '–'}
            </p>
          </div>
        </Card>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Card className="p-3">
            <p className="text-xl font-extrabold">{ov.data?.allTimeWorkouts ?? '–'}</p>
            <p className="text-xs text-muted">Trainings</p>
          </Card>
          <Card className="p-3">
            <p className="text-xl font-extrabold">{ov.data?.streak.longest ?? '–'}</p>
            <p className="text-xs text-muted">Längste Serie</p>
          </Card>
          <Card className="p-3">
            <p className="text-xl font-extrabold">{user.settings.gamificationEnabled ? unlocked : '–'}</p>
            <p className="text-xs text-muted">Erfolge</p>
          </Card>
        </div>
        <Card className="divide-y divide-border overflow-hidden">
          <ListRow icon={<UserCog />} title="Profil & Trainingsziel" subtitle="Ziel, Level, Trainingstage, Körperdaten" onClick={() => setEdit(true)} right={<ChevronRight className="h-5 w-5 text-muted" />} />
          <ListRow
            icon={<Users />}
            title="Freunde"
            subtitle={friends.data ? `${friends.data.friends.length} Freunde · gemeinsam trainieren` : 'Gemeinsam trainieren'}
            to="/social?tab=friends"
            right={
              <span className="flex items-center gap-2">
                {friendRequests > 0 && <Badge tone="primary" aria-label={`${friendRequests} offene Anfragen`}>{friendRequests}</Badge>}
                <ChevronRight className="h-5 w-5 text-muted" />
              </span>
            }
          />
          <ListRow icon={<Settings />} title="Einstellungen" subtitle="Einheit, Pausentimer, Motivation, Darstellung" to="/profile/settings" right={<ChevronRight className="h-5 w-5 text-muted" />} />
          {user.settings.gamificationEnabled && <ListRow icon={<Award />} title="Erfolge" subtitle={`${unlocked} freigeschaltet`} to="/profile/achievements" right={<ChevronRight className="h-5 w-5 text-muted" />} />}
          <ListRow icon={<Scale />} title="Körpergewicht & Maße" to="/profile/body" right={<ChevronRight className="h-5 w-5 text-muted" />} />
        </Card>
        <Card className="divide-y divide-border overflow-hidden">
          <ListRow icon={<Shield />} title="Konto & Sicherheit" subtitle={user.email} to="/profile/account" right={<ChevronRight className="h-5 w-5 text-muted" />} />
          <ListRow icon={<Database />} title="Daten exportieren & importieren" to="/profile/data" right={<ChevronRight className="h-5 w-5 text-muted" />} />
          <ListRow icon={<Shield />} title="Datenschutz" to="/profile/privacy" right={<ChevronRight className="h-5 w-5 text-muted" />} />
          <ListRow icon={<LogOut />} title="Abmelden" danger onClick={() => void tryLogout()} />
        </Card>
        <p className="text-center text-xs text-muted">SATZIO 1.0 · Trainieren statt Tippen.</p>
      </div>
      <EditProfileSheet open={edit} onOpenChange={setEdit} />
      <ConfirmSheet
        open={logoutWarn !== null}
        onOpenChange={(o) => !o && setLogoutWarn(null)}
        title="Nicht synchronisierte Änderungen"
        text={`${logoutWarn} Änderung(en) sind noch nicht auf dem Server. Beim Abmelden gehen sie verloren. Stelle zuerst eine Verbindung her, um sie zu speichern.`}
        confirmLabel="Trotzdem abmelden"
        onConfirm={() => void logout()}
      />
    </div>
  );
}
