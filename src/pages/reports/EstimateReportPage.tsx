import { Download, Gauge, Play } from 'lucide-react';
import { useMemo, useState } from 'react';

import { PageHeader } from '@/components/layout/PageHeader';
import { ActionButton } from '@/components/ui/ActionButton';
import { EmptyState, ErrorNotice, LoadingSkeleton } from '@/components/ui/FeedbackStates';
import { FormField, TextArea } from '@/components/ui/FormField';
import { ProgressMeter } from '@/components/ui/ProgressMeter';
import { SurfacePanel } from '@/components/ui/SurfacePanel';
import { useAsync } from '@/hooks/useAsync';
import { JiraClient } from '@/services/jira-client';
import type { JiraIssue } from '@/types/jira';
import { downloadFile, toCsv } from '@/utils/csv';
import { formatDuration } from '@/utils/duration';
import { classNames } from '@/utils/misc';

import styles from './ReportPages.module.css';

const JQL_PRESETS = [
  { label: 'Minhas, últimos 30 dias', jql: 'assignee = currentUser() AND updated >= -30d ORDER BY updated DESC' },
  { label: 'Concluídas por mim no mês', jql: 'assignee = currentUser() AND statusCategory = Done AND resolved >= startOfMonth()' },
  { label: 'Sprint ativa', jql: 'sprint in openSprints() ORDER BY rank' },
];

const ISSUE_LIMIT = 300;

function formatVariance(seconds: number): string {
  if (seconds === 0) {
    return '0';
  }
  return `${seconds > 0 ? '+' : '−'}${formatDuration(Math.abs(seconds))}`;
}

export function EstimateReportPage() {
  const [jql, setJql] = useState(JQL_PRESETS[0].jql);
  const [submittedJql, setSubmittedJql] = useState<string | null>(null);

  const result = useAsync<JiraIssue[]>(
    async () => (submittedJql ? (await JiraClient.fromStorage()).searchIssues(submittedJql, ISSUE_LIMIT) : []),
    [submittedJql],
    Boolean(submittedJql),
  );

  const totals = useMemo(() => {
    const issues = result.data ?? [];
    const estimated = issues.filter((issue) => issue.originalEstimateSeconds > 0);
    return {
      estimate: issues.reduce((sum, issue) => sum + issue.originalEstimateSeconds, 0),
      spent: issues.reduce((sum, issue) => sum + issue.timeSpentSeconds, 0),
      withoutEstimate: issues.length - estimated.length,
      overrun: estimated.filter((issue) => issue.timeSpentSeconds > issue.originalEstimateSeconds).length,
    };
  }, [result.data]);

  const handleExport = (): void => {
    const rows = (result.data ?? []).map((issue) => [
      issue.key,
      issue.summary,
      issue.statusName,
      (issue.originalEstimateSeconds / 3600).toFixed(2).replace('.', ','),
      (issue.timeSpentSeconds / 3600).toFixed(2).replace('.', ','),
    ]);
    downloadFile(
      'estimado-vs-realizado.csv',
      toCsv([['Issue', 'Resumo', 'Status', 'Estimado (h)', 'Registrado (h)'], ...rows]),
      'text/csv',
    );
  };

  return (
    <div className={styles.reportPage}>
      <PageHeader title="Estimado × realizado" description="Compare a estimativa original com o tempo registrado em cada issue." />

      <SurfacePanel>
        <FormField label="Consulta JQL" hint={`Até ${ISSUE_LIMIT} issues.`}>
          {(controlId, describedBy) => (
            <TextArea
              id={controlId}
              aria-describedby={describedBy}
              isMonospace
              value={jql}
              onChange={(event) => setJql(event.target.value)}
            />
          )}
        </FormField>
        <div className={styles.reportPage__resultHeader}>
          <div className={styles.reportPage__presets}>
            {JQL_PRESETS.map((preset) => (
              <ActionButton key={preset.label} variant="ghost" isCompact onClick={() => setJql(preset.jql)}>
                {preset.label}
              </ActionButton>
            ))}
          </div>
          <ActionButton
            variant="primary"
            icon={Play}
            isLoading={result.isLoading}
            disabled={!jql.trim()}
            onClick={() => {
              setSubmittedJql(jql.trim());
              if (submittedJql === jql.trim()) {
                result.reload();
              }
            }}
          >
            Gerar
          </ActionButton>
        </div>
      </SurfacePanel>

      {!submittedJql && <EmptyState icon={Gauge} title="Monte a consulta e gere o relatório" />}
      {result.isLoading && <LoadingSkeleton lines={5} />}
      {result.error && <ErrorNotice message={result.error} />}

      {result.data && !result.isLoading && submittedJql && (
        <SurfacePanel
          actions={
            <ActionButton icon={Download} isCompact onClick={handleExport}>
              Exportar CSV
            </ActionButton>
          }
          title={`${result.data.length} issues`}
        >
          <div className={styles.reportPage__metrics}>
            <div className={styles.reportPage__metric}>
              <span className={styles.reportPage__metricLabel}>Estimado</span>
              <span className={styles.reportPage__metricValue}>{formatDuration(totals.estimate)}</span>
            </div>
            <div className={styles.reportPage__metric}>
              <span className={styles.reportPage__metricLabel}>Registrado</span>
              <span className={styles.reportPage__metricValue}>{formatDuration(totals.spent)}</span>
            </div>
            <div className={styles.reportPage__metric}>
              <span className={styles.reportPage__metricLabel}>Estouraram</span>
              <span className={styles.reportPage__metricValue}>{totals.overrun}</span>
            </div>
            <div className={styles.reportPage__metric}>
              <span className={styles.reportPage__metricLabel}>Sem estimativa</span>
              <span className={styles.reportPage__metricValue}>{totals.withoutEstimate}</span>
            </div>
          </div>

          <div className={styles.reportPage__tableScroller}>
            <table className={styles.reportPage__table}>
              <thead>
                <tr>
                  <th className={styles.reportPage__labelCell}>Issue</th>
                  <th>Status</th>
                  <th>Estimado</th>
                  <th>Registrado</th>
                  <th>Variação</th>
                  <th className={styles.reportPage__barCell}>Consumo</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((issue) => {
                  const variance = issue.timeSpentSeconds - issue.originalEstimateSeconds;
                  const hasEstimate = issue.originalEstimateSeconds > 0;
                  return (
                    <tr key={issue.key}>
                      <td className={styles.reportPage__labelCell} title={issue.summary}>
                        <span className={styles.reportPage__issueKey}>{issue.key}</span> {issue.summary}
                      </td>
                      <td>{issue.statusName}</td>
                      <td>{hasEstimate ? formatDuration(issue.originalEstimateSeconds) : '—'}</td>
                      <td>{formatDuration(issue.timeSpentSeconds)}</td>
                      <td
                        className={classNames(
                          hasEstimate && variance > 0 && styles.reportPage__varianceOver,
                          hasEstimate && variance < 0 && styles.reportPage__varianceUnder,
                        )}
                      >
                        {hasEstimate ? formatVariance(variance) : '—'}
                      </td>
                      <td className={styles.reportPage__barCell}>
                        {hasEstimate && (
                          <ProgressMeter
                            value={issue.timeSpentSeconds}
                            max={issue.originalEstimateSeconds}
                            label={`Consumo de ${issue.key}`}
                            isThin
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SurfacePanel>
      )}
    </div>
  );
}
