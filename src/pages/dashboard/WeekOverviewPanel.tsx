import { CheckCircle2, UploadCloud } from 'lucide-react';

import { ActionButton } from '@/components/ui/ActionButton';
import { ProgressMeter } from '@/components/ui/ProgressMeter';
import { SurfacePanel } from '@/components/ui/SurfacePanel';
import { useStoredValue } from '@/hooks/useStoredValue';
import type { WeekTotals } from '@/hooks/useWeekTotals';
import { useWorklogUpload } from '@/hooks/useWorklogUpload';
import { formatDuration } from '@/utils/duration';
import { classNames } from '@/utils/misc';

import { WeekBarsChart } from './WeekBarsChart';
import styles from './WeekOverviewPanel.module.css';

interface WeekOverviewPanelProps {
  totals: WeekTotals;
}

export function WeekOverviewPanel({ totals }: WeekOverviewPanelProps) {
  const { value: settings } = useStoredValue('settings');
  const { value: worklogs } = useStoredValue('worklogs');
  const { upload, isUploading } = useWorklogUpload();

  const dailyTargetSeconds = settings.dailyTargetHours * 3600;
  const weeklyTargetSeconds = dailyTargetSeconds * settings.workingDays.length;
  const pendingIds = worklogs.filter((worklog) => worklog.status === 'pending').map((worklog) => worklog.id);

  const syncStatus =
    pendingIds.length > 0 ? (
      <div className={styles.weekOverview__sync}>
        <span>{pendingIds.length === 1 ? '1 worklog pendente' : `${pendingIds.length} worklogs pendentes`}</span>
        <ActionButton isCompact icon={UploadCloud} isLoading={isUploading} onClick={() => void upload(pendingIds)}>
          Enviar
        </ActionButton>
      </div>
    ) : (
      <div className={classNames(styles.weekOverview__sync, styles['weekOverview__sync--clear'])}>
        <CheckCircle2 size={16} aria-hidden />
        <span>Sincronizado com o Jira</span>
      </div>
    );

  return (
    <SurfacePanel
      title="Sua semana"
      subtitle={`Meta diária de ${settings.dailyTargetHours}h · inclui pendentes locais e horas do Jira`}
      actions={syncStatus}
    >
      <div className={styles.weekOverview__body}>
        <div className={styles.weekOverview__stats}>
          <div className={styles.weekOverview__stat}>
            <div className={styles.weekOverview__statHeading}>
              <span className={styles.weekOverview__statLabel}>Hoje</span>
              <span className={styles.weekOverview__statValue}>
                {formatDuration(totals.todaySeconds)}
                <span className={styles.weekOverview__statGoal}> / {settings.dailyTargetHours}h</span>
              </span>
            </div>
            <ProgressMeter value={totals.todaySeconds} max={dailyTargetSeconds} label="Progresso do dia" isThin />
          </div>
          <div className={styles.weekOverview__stat}>
            <div className={styles.weekOverview__statHeading}>
              <span className={styles.weekOverview__statLabel}>Semana</span>
              <span className={styles.weekOverview__statValue}>
                {formatDuration(totals.weekSeconds)}
                <span className={styles.weekOverview__statGoal}> / {weeklyTargetSeconds / 3600}h</span>
              </span>
            </div>
            <ProgressMeter value={totals.weekSeconds} max={weeklyTargetSeconds} label="Progresso da semana" isThin />
          </div>
        </div>
        <WeekBarsChart totals={totals} targetSeconds={dailyTargetSeconds} />
      </div>
    </SurfacePanel>
  );
}
