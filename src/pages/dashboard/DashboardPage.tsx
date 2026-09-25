import { Plus } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { TimerPanel } from '@/components/timer/TimerPanel';
import { ActionButton } from '@/components/ui/ActionButton';
import { SurfacePanel } from '@/components/ui/SurfacePanel';
import { useWorklogEditor } from '@/components/worklog/WorklogEditorProvider';
import { useStoredValue } from '@/hooks/useStoredValue';
import { useWeekTotals } from '@/hooks/useWeekTotals';
import { formatLongDate } from '@/utils/date';

import styles from './DashboardPage.module.css';
import { MyIssuesPanel } from './MyIssuesPanel';
import { TodayPanel } from './TodayPanel';
import { WeekBarsPanel } from './WeekBarsPanel';

function getGreeting(hour: number): string {
  if (hour < 12) {
    return 'Bom dia';
  }
  return hour < 18 ? 'Boa tarde' : 'Boa noite';
}

export function DashboardPage() {
  const { openWorklogEditor } = useWorklogEditor();
  const { value: account } = useStoredValue('account');
  const { value: worklogs } = useStoredValue('worklogs');
  const totals = useWeekTotals(worklogs);
  const now = new Date();
  const firstName = account?.user.displayName.split(' ')[0] ?? '';

  return (
    <>
      <PageHeader
        eyebrow={formatLongDate(now)}
        title={`${getGreeting(now.getHours())}${firstName ? `, ${firstName}` : ''}`}
        actions={
          <ActionButton variant="primary" icon={Plus} onClick={() => openWorklogEditor()}>
            Novo worklog
          </ActionButton>
        }
      />
      <div className={styles.dashboardPage}>
        <SurfacePanel title="Timer">
          <TimerPanel />
        </SurfacePanel>
        <TodayPanel totals={totals} />
        <WeekBarsPanel totals={totals} />
        <div className={styles.dashboardPage__wide}>
          <MyIssuesPanel />
        </div>
      </div>
    </>
  );
}
