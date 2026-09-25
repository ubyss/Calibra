import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { Plus } from 'lucide-react';
import { useMemo } from 'react';

import { PageHeader } from '@/components/layout/PageHeader';
import { ActionButton } from '@/components/ui/ActionButton';
import { useWorklogEditor } from '@/components/worklog/WorklogEditorProvider';
import { useAsync } from '@/hooks/useAsync';
import { useStoredValue } from '@/hooks/useStoredValue';
import { useWeekTotals } from '@/hooks/useWeekTotals';
import { CalendarPanel } from '@/pages/calendar/CalendarPage';
import { fetchRemoteWorklogs } from '@/services/worklog-service';
import { formatLongDate, getWeekDays, toDateKey } from '@/utils/date';

import styles from './DashboardPage.module.css';
import { WeekOverviewPanel } from './WeekOverviewPanel';

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
  const now = new Date();
  const todayKey = toDateKey(now);
  const weekDays = useMemo(() => getWeekDays(parseISO(todayKey)), [todayKey]);
  const weekStart = startOfDay(weekDays[0]);
  const weekEnd = endOfDay(weekDays[6]);
  const weekKey = toDateKey(weekStart);

  const remote = useAsync(
    () => fetchRemoteWorklogs(account ? [account.user] : [], weekStart, weekEnd),
    [weekKey, account?.user.id],
    Boolean(account),
  );
  const totals = useWeekTotals(worklogs, remote.data ?? []);
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
        <WeekOverviewPanel totals={totals} />
        <CalendarPanel />
      </div>
    </>
  );
}
