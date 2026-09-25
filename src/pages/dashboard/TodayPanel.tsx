import { CheckCircle2, UploadCloud } from 'lucide-react';

import { ActionButton } from '@/components/ui/ActionButton';
import { ProgressMeter } from '@/components/ui/ProgressMeter';
import { SurfacePanel } from '@/components/ui/SurfacePanel';
import { useStoredValue } from '@/hooks/useStoredValue';
import type { WeekTotals } from '@/hooks/useWeekTotals';
import { useWorklogUpload } from '@/hooks/useWorklogUpload';
import { formatDuration } from '@/utils/duration';
import { classNames } from '@/utils/misc';

import styles from './DashboardPage.module.css';

export function TodayPanel({ totals }: { totals: WeekTotals }) {
  const { value: settings } = useStoredValue('settings');
  const { value: worklogs } = useStoredValue('worklogs');
  const { upload, isUploading } = useWorklogUpload();

  const dailyTargetSeconds = settings.dailyTargetHours * 3600;
  const weeklyTargetSeconds = dailyTargetSeconds * settings.workingDays.length;
  const pendingIds = worklogs.filter((worklog) => worklog.status === 'pending').map((worklog) => worklog.id);

  return (
    <SurfacePanel title="Seu ritmo" subtitle="Registrado localmente, incluindo pendentes">
      <div className={styles.dashboardPage__stats}>
        <div className={styles.dashboardPage__stat}>
          <span className={styles.dashboardPage__statLabel}>Hoje</span>
          <span className={styles.dashboardPage__statValue}>
            {formatDuration(totals.todaySeconds)}
            <span className={styles.dashboardPage__statGoal}> / {settings.dailyTargetHours}h</span>
          </span>
          <ProgressMeter value={totals.todaySeconds} max={dailyTargetSeconds} label="Progresso do dia" isThin />
        </div>
        <div className={styles.dashboardPage__stat}>
          <span className={styles.dashboardPage__statLabel}>Semana</span>
          <span className={styles.dashboardPage__statValue}>
            {formatDuration(totals.weekSeconds)}
            <span className={styles.dashboardPage__statGoal}> / {weeklyTargetSeconds / 3600}h</span>
          </span>
          <ProgressMeter value={totals.weekSeconds} max={weeklyTargetSeconds} label="Progresso da semana" isThin />
        </div>
      </div>

      {pendingIds.length > 0 ? (
        <div className={styles.dashboardPage__pending}>
          <span>
            {pendingIds.length === 1 ? '1 worklog aguardando envio' : `${pendingIds.length} worklogs aguardando envio`}
          </span>
          <ActionButton isCompact icon={UploadCloud} isLoading={isUploading} onClick={() => void upload(pendingIds)}>
            Enviar
          </ActionButton>
        </div>
      ) : (
        <div className={classNames(styles.dashboardPage__pending, styles['dashboardPage__pending--clear'])}>
          <span>Tudo sincronizado com o Jira</span>
          <CheckCircle2 size={18} aria-hidden />
        </div>
      )}
    </SurfacePanel>
  );
}
