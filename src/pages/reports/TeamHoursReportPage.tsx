import { differenceInCalendarDays, endOfDay, endOfMonth, endOfWeek, startOfDay, startOfMonth, startOfWeek, subWeeks } from 'date-fns';
import { BarChart3, Download, Play } from 'lucide-react';
import { useMemo, useState } from 'react';

import { PageHeader } from '@/components/layout/PageHeader';
import { ActionButton } from '@/components/ui/ActionButton';
import { EmptyState, ErrorNotice, LoadingSkeleton } from '@/components/ui/FeedbackStates';
import { FormField, SelectInput, TextInput } from '@/components/ui/FormField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SurfacePanel } from '@/components/ui/SurfacePanel';
import { useAsync } from '@/hooks/useAsync';
import { useStoredValue } from '@/hooks/useStoredValue';
import { fetchRemoteWorklogs } from '@/services/worklog-service';
import type { JiraUserSummary } from '@/types/domain';
import type { JiraRemoteWorklog } from '@/types/jira';
import { downloadFile } from '@/utils/csv';
import { toDateKey } from '@/utils/date';
import { formatDuration } from '@/utils/duration';

import styles from './ReportPages.module.css';
import { buildTeamHoursMatrix, teamHoursToCsv } from './team-hours-model';
import { TeamHoursByDayTable, TeamHoursByIssueTable } from './TeamHoursTables';

const MAX_RANGE_DAYS = 62;
const ONLY_ME = 'me';

interface ReportRequest {
  users: JiraUserSummary[];
  from: Date;
  to: Date;
}

const PRESETS = [
  { label: 'Esta semana', range: (now: Date) => [startOfWeek(now, { weekStartsOn: 1 }), endOfWeek(now, { weekStartsOn: 1 })] },
  {
    label: 'Semana passada',
    range: (now: Date) => [startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })],
  },
  { label: 'Este mês', range: (now: Date) => [startOfMonth(now), endOfMonth(now)] },
];

export function TeamHoursReportPage() {
  const { value: account } = useStoredValue('account');
  const { value: groups } = useStoredValue('groups');
  const { value: settings } = useStoredValue('settings');
  const [groupId, setGroupId] = useState(ONLY_ME);
  const [fromDate, setFromDate] = useState(() => toDateKey(startOfWeek(new Date(), { weekStartsOn: 1 })));
  const [toDate, setToDate] = useState(() => toDateKey(endOfWeek(new Date(), { weekStartsOn: 1 })));
  const [view, setView] = useState<'day' | 'issue'>('day');
  const [request, setRequest] = useState<ReportRequest | null>(null);

  const rangeDays = differenceInCalendarDays(new Date(toDate), new Date(fromDate)) + 1;
  const rangeError =
    rangeDays < 1 ? 'A data final precisa ser depois da inicial.' : rangeDays > MAX_RANGE_DAYS ? `Escolha até ${MAX_RANGE_DAYS} dias.` : null;

  const report = useAsync<JiraRemoteWorklog[]>(
    async () => (request ? fetchRemoteWorklogs(request.users, request.from, request.to) : []),
    [request],
    Boolean(request),
  );

  const matrix = useMemo(
    () => (request && report.data ? buildTeamHoursMatrix(request.users, report.data, request.from, request.to) : null),
    [request, report.data],
  );

  const handleGenerate = (): void => {
    const users = groupId === ONLY_ME ? (account ? [account.user] : []) : groups.find((group) => group.id === groupId)?.users ?? [];
    setRequest({
      users,
      from: startOfDay(new Date(`${fromDate}T00:00:00`)),
      to: endOfDay(new Date(`${toDate}T00:00:00`)),
    });
  };

  const workingDaysInRange = matrix ? matrix.days.filter((day) => settings.workingDays.includes(day.getDay())).length : 0;
  const expectedSeconds = matrix ? workingDaysInRange * settings.dailyTargetHours * 3600 * matrix.rows.length : 0;

  return (
    <div className={styles.reportPage}>
      <PageHeader
        title="Horas da equipe"
        description="Worklogs registrados no Jira por pessoa e por dia. Monte grupos para acompanhar o time."
      />

      <SurfacePanel>
        <div className={styles.reportPage__filters}>
          <FormField label="Quem">
            {(controlId) => (
              <SelectInput id={controlId} value={groupId} onChange={(event) => setGroupId(event.target.value)}>
                <option value={ONLY_ME}>Somente eu</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name} ({group.users.length})
                  </option>
                ))}
              </SelectInput>
            )}
          </FormField>
          <FormField label="De" error={rangeError}>
            {(controlId) => <TextInput id={controlId} type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />}
          </FormField>
          <FormField label="Até">
            {(controlId) => <TextInput id={controlId} type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />}
          </FormField>
          <ActionButton variant="primary" icon={Play} disabled={Boolean(rangeError)} isLoading={report.isLoading} onClick={handleGenerate}>
            Gerar
          </ActionButton>
        </div>
        <div className={styles.reportPage__presets}>
          {PRESETS.map((preset) => (
            <ActionButton
              key={preset.label}
              variant="ghost"
              isCompact
              onClick={() => {
                const [start, end] = preset.range(new Date());
                setFromDate(toDateKey(start));
                setToDate(toDateKey(end));
              }}
            >
              {preset.label}
            </ActionButton>
          ))}
        </div>
      </SurfacePanel>

      {report.isLoading && <LoadingSkeleton lines={5} />}
      {report.error && <ErrorNotice message={report.error} />}
      {!request && (
        <EmptyState icon={BarChart3} title="Escolha o período e gere o relatório" description="Os dados vêm direto do Jira e não são guardados." />
      )}

      {matrix && !report.isLoading && (
        <SurfacePanel>
          <div className={styles.reportPage__metrics}>
            <div className={styles.reportPage__metric}>
              <span className={styles.reportPage__metricLabel}>Total registrado</span>
              <span className={styles.reportPage__metricValue}>{formatDuration(matrix.totalSeconds)}</span>
            </div>
            <div className={styles.reportPage__metric}>
              <span className={styles.reportPage__metricLabel}>Esperado</span>
              <span className={styles.reportPage__metricValue}>{formatDuration(expectedSeconds)}</span>
            </div>
            <div className={styles.reportPage__metric}>
              <span className={styles.reportPage__metricLabel}>Cobertura</span>
              <span className={styles.reportPage__metricValue}>
                {expectedSeconds ? Math.round((matrix.totalSeconds / expectedSeconds) * 100) : 0}%
              </span>
            </div>
            <div className={styles.reportPage__metric}>
              <span className={styles.reportPage__metricLabel}>Issues</span>
              <span className={styles.reportPage__metricValue}>{matrix.issueRows.length}</span>
            </div>
          </div>

          <div className={styles.reportPage__resultHeader}>
            <SegmentedControl
              ariaLabel="Visualização"
              value={view}
              onChange={setView}
              options={[
                { value: 'day', label: 'Por dia' },
                { value: 'issue', label: 'Por issue' },
              ]}
            />
            <ActionButton
              icon={Download}
              isCompact
              onClick={() => downloadFile(`horas-${fromDate}-a-${toDate}.csv`, teamHoursToCsv(matrix), 'text/csv')}
            >
              Exportar CSV
            </ActionButton>
          </div>

          {view === 'day' ? (
            <TeamHoursByDayTable matrix={matrix} targetSeconds={settings.dailyTargetHours * 3600} />
          ) : (
            <TeamHoursByIssueTable matrix={matrix} />
          )}
        </SurfacePanel>
      )}
    </div>
  );
}
