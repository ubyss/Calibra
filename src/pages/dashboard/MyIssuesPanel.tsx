import { Inbox, Play, Plus, RefreshCw, Star } from 'lucide-react';
import { motion } from 'motion/react';

import { ActionButton } from '@/components/ui/ActionButton';
import { EmptyState, ErrorNotice, LoadingSkeleton } from '@/components/ui/FeedbackStates';
import { StatusTag, type StatusTagTone } from '@/components/ui/ProgressMeter';
import { SurfacePanel } from '@/components/ui/SurfacePanel';
import { useToast } from '@/components/ui/ToastProvider';
import { useWorklogEditor } from '@/components/worklog/WorklogEditorProvider';
import { MY_OPEN_ISSUES_JQL } from '@/constants/defaults';
import { useAsync } from '@/hooks/useAsync';
import { useStoredValue } from '@/hooks/useStoredValue';
import { toggleBookmark } from '@/services/bookmark-service';
import { JiraClient } from '@/services/jira-client';
import { startTimer } from '@/services/timer-service';
import type { JiraIssue, JiraStatusCategory } from '@/types/jira';

import styles from './DashboardPage.module.css';

const STATUS_TONES: Record<JiraStatusCategory, StatusTagTone> = {
  new: 'neutral',
  indeterminate: 'accent',
  done: 'success',
};

async function loadMyIssues(): Promise<{ issues: JiraIssue[]; client: JiraClient }> {
  const client = await JiraClient.fromStorage();
  return { issues: await client.searchIssues(MY_OPEN_ISSUES_JQL, 15), client };
}

export function MyIssuesPanel() {
  const { notify } = useToast();
  const { openWorklogEditor } = useWorklogEditor();
  const { value: bookmarks } = useStoredValue('bookmarks');
  const { data, error, isLoading, reload } = useAsync(loadMyIssues, []);
  const bookmarkedKeys = new Set(bookmarks.map((bookmark) => bookmark.issueKey));

  return (
    <SurfacePanel
      title="Minhas issues abertas"
      subtitle="Atribuídas a você no Jira"
      actions={<ActionButton variant="ghost" isCompact icon={RefreshCw} label="Atualizar" onClick={reload} />}
    >
      {isLoading && <LoadingSkeleton lines={4} />}
      {error && <ErrorNotice message={error} />}
      {data && data.issues.length === 0 && (
        <EmptyState icon={Inbox} title="Nada atribuído a você" description="Quando houver issues abertas, elas aparecem aqui." />
      )}
      {data && data.issues.length > 0 && (
        <motion.ul
          className={styles.dashboardPage__issueList}
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.03 } } }}
        >
          {data.issues.map((issue) => (
            <motion.li
              key={issue.key}
              className={styles.dashboardPage__issue}
              variants={{ hidden: { opacity: 0, x: -8 }, visible: { opacity: 1, x: 0 } }}
            >
              <span className={styles.dashboardPage__issueText}>
                <a
                  className={styles.dashboardPage__issueKey}
                  href={data.client.issueUrl(issue.key)}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {issue.key}
                </a>
                <span className={styles.dashboardPage__issueSummary}>{issue.summary}</span>
              </span>
              <StatusTag tone={STATUS_TONES[issue.statusCategory]}>{issue.statusName}</StatusTag>
              <span className={styles.dashboardPage__issueActions}>
                <ActionButton
                  variant="ghost"
                  isCompact
                  icon={Star}
                  label={bookmarkedKeys.has(issue.key) ? 'Remover dos favoritos' : 'Favoritar'}
                  aria-pressed={bookmarkedKeys.has(issue.key)}
                  onClick={() => void toggleBookmark(issue.key, issue.summary)}
                />
                <ActionButton
                  variant="ghost"
                  isCompact
                  icon={Plus}
                  label="Registrar tempo"
                  onClick={() => openWorklogEditor({ draft: { issueKey: issue.key, issueSummary: issue.summary } })}
                />
                <ActionButton
                  variant="ghost"
                  isCompact
                  icon={Play}
                  label="Iniciar timer"
                  onClick={() =>
                    void startTimer(issue.key, issue.summary).then(() => notify(`Timer iniciado em ${issue.key}.`))
                  }
                />
              </span>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </SurfacePanel>
  );
}
