import { format, parseISO } from 'date-fns';
import { Timer } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';

import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState, ErrorNotice, LoadingSkeleton } from '@/components/ui/FeedbackStates';
import { FormField, SelectInput, TextInput } from '@/components/ui/FormField';
import { ProgressMeter } from '@/components/ui/ProgressMeter';
import { SurfacePanel } from '@/components/ui/SurfacePanel';
import { useAsync } from '@/hooks/useAsync';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { JiraClient } from '@/services/jira-client';
import type { JiraIssue, JiraSprint, JiraStatusCategory } from '@/types/jira';
import { formatDuration } from '@/utils/duration';

import styles from './ReportPages.module.css';

const STATUS_COLUMNS: { category: JiraStatusCategory; title: string }[] = [
  { category: 'new', title: 'A fazer' },
  { category: 'indeterminate', title: 'Em andamento' },
  { category: 'done', title: 'Concluído' },
];

const SPRINT_STATE_LABELS: Record<JiraSprint['state'], string> = {
  active: 'ativa',
  closed: 'encerrada',
  future: 'futura',
};

function formatSprintDates(sprint: JiraSprint): string {
  if (!sprint.startDate) {
    return '';
  }
  const end = sprint.completeDate ?? sprint.endDate;
  return `${format(parseISO(sprint.startDate), 'dd/MM')} – ${end ? format(parseISO(end), 'dd/MM') : '?'}`;
}

export function SprintReportPage() {
  const [boardQuery, setBoardQuery] = useState('');
  const [boardId, setBoardId] = useState<number | null>(null);
  const [sprintId, setSprintId] = useState<number | null>(null);
  const debouncedBoardQuery = useDebouncedValue(boardQuery, 400);

  const boards = useAsync(async () => (await JiraClient.fromStorage()).getBoards(debouncedBoardQuery), [debouncedBoardQuery]);
  const sprints = useAsync<JiraSprint[]>(
    async () => (boardId ? (await JiraClient.fromStorage()).getSprints(boardId) : []),
    [boardId],
    Boolean(boardId),
  );
  const issues = useAsync<JiraIssue[]>(
    async () => (sprintId ? (await JiraClient.fromStorage()).getSprintIssues(sprintId) : []),
    [sprintId],
    Boolean(sprintId),
  );

  const summary = useMemo(() => {
    const list = issues.data ?? [];
    const byCategory = new Map<JiraStatusCategory, JiraIssue[]>(STATUS_COLUMNS.map(({ category }) => [category, []]));
    list.forEach((issue) => byCategory.get(issue.statusCategory)?.push(issue));
    return {
      total: list.length,
      done: byCategory.get('done')?.length ?? 0,
      estimate: list.reduce((sum, issue) => sum + issue.originalEstimateSeconds, 0),
      spent: list.reduce((sum, issue) => sum + issue.timeSpentSeconds, 0),
      byCategory,
    };
  }, [issues.data]);

  const selectedSprint = sprints.data?.find((sprint) => sprint.id === sprintId);

  return (
    <div className={styles.reportPage}>
      <PageHeader title="Relatório de sprint" description="Progresso, esforço estimado e registrado de uma sprint." />

      <SurfacePanel>
        <div className={styles.reportPage__filters}>
          <FormField label="Buscar board">
            {(controlId) => (
              <TextInput
                id={controlId}
                placeholder="Nome do board"
                value={boardQuery}
                onChange={(event) => setBoardQuery(event.target.value)}
              />
            )}
          </FormField>
          <FormField label="Board">
            {(controlId) => (
              <SelectInput
                id={controlId}
                value={boardId ?? ''}
                onChange={(event) => {
                  setBoardId(event.target.value ? Number(event.target.value) : null);
                  setSprintId(null);
                }}
              >
                <option value="">{boards.isLoading ? 'Carregando…' : 'Selecione'}</option>
                {boards.data?.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.name}
                  </option>
                ))}
              </SelectInput>
            )}
          </FormField>
          <FormField label="Sprint">
            {(controlId) => (
              <SelectInput
                id={controlId}
                value={sprintId ?? ''}
                disabled={!boardId}
                onChange={(event) => setSprintId(event.target.value ? Number(event.target.value) : null)}
              >
                <option value="">{sprints.isLoading ? 'Carregando…' : 'Selecione'}</option>
                {sprints.data?.map((sprint) => (
                  <option key={sprint.id} value={sprint.id}>
                    {sprint.name} ({SPRINT_STATE_LABELS[sprint.state]})
                  </option>
                ))}
              </SelectInput>
            )}
          </FormField>
        </div>
        {(boards.error || sprints.error) && <ErrorNotice message={boards.error ?? sprints.error ?? ''} />}
      </SurfacePanel>

      {!sprintId && <EmptyState icon={Timer} title="Escolha um board e uma sprint" description="Boards Kanban não possuem sprints." />}
      {issues.isLoading && <LoadingSkeleton lines={4} />}
      {issues.error && <ErrorNotice message={issues.error} />}

      {sprintId && issues.data && !issues.isLoading && (
        <SurfacePanel title={selectedSprint?.name} subtitle={selectedSprint ? formatSprintDates(selectedSprint) : undefined}>
          <div className={styles.reportPage__metrics}>
            <div className={styles.reportPage__metric}>
              <span className={styles.reportPage__metricLabel}>Issues</span>
              <span className={styles.reportPage__metricValue}>{summary.total}</span>
            </div>
            <div className={styles.reportPage__metric}>
              <span className={styles.reportPage__metricLabel}>Concluídas</span>
              <span className={styles.reportPage__metricValue}>
                {summary.total ? Math.round((summary.done / summary.total) * 100) : 0}%
              </span>
            </div>
            <div className={styles.reportPage__metric}>
              <span className={styles.reportPage__metricLabel}>Estimado</span>
              <span className={styles.reportPage__metricValue}>{formatDuration(summary.estimate)}</span>
            </div>
            <div className={styles.reportPage__metric}>
              <span className={styles.reportPage__metricLabel}>Registrado</span>
              <span className={styles.reportPage__metricValue}>{formatDuration(summary.spent)}</span>
            </div>
          </div>

          <ProgressMeter value={summary.done} max={summary.total} label="Issues concluídas" />

          <div className={styles.reportPage__statusColumns}>
            {STATUS_COLUMNS.map(({ category, title }) => {
              const columnIssues = summary.byCategory.get(category) ?? [];
              return (
                <div key={category} className={styles.reportPage__statusColumn}>
                  <span className={styles.reportPage__statusTitle}>
                    {title}
                    <span>{columnIssues.length}</span>
                  </span>
                  {columnIssues.map((issue, index) => (
                    <motion.div
                      key={issue.key}
                      className={styles.reportPage__statusIssue}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.02, 0.4) }}
                    >
                      <span className={styles.reportPage__issueKey}>{issue.key}</span>
                      <span className={styles.reportPage__statusIssueSummary}>{issue.summary}</span>
                      <span className={styles.reportPage__statusIssueMeta}>
                        {issue.assigneeName ?? 'Sem responsável'} · {formatDuration(issue.timeSpentSeconds)}
                        {issue.originalEstimateSeconds ? ` de ${formatDuration(issue.originalEstimateSeconds)}` : ''}
                      </span>
                    </motion.div>
                  ))}
                </div>
              );
            })}
          </div>
        </SurfacePanel>
      )}
    </div>
  );
}
