import { Bookmark, ExternalLink, Play, Plus, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';

import { IssuePicker } from '@/components/issue/IssuePicker';
import type { IssueSelection } from '@/components/issue/useIssueSuggestions';
import { PageHeader } from '@/components/layout/PageHeader';
import { ActionButton } from '@/components/ui/ActionButton';
import { EmptyState } from '@/components/ui/FeedbackStates';
import { SurfacePanel } from '@/components/ui/SurfacePanel';
import { useToast } from '@/components/ui/ToastProvider';
import { useWorklogEditor } from '@/components/worklog/WorklogEditorProvider';
import { useStoredValue } from '@/hooks/useStoredValue';
import { removeBookmark, toggleBookmark } from '@/services/bookmark-service';
import { startTimer } from '@/services/timer-service';
import styles from '@/pages/organization/OrganizationPages.module.css';

export function BookmarksPage() {
  const { notify } = useToast();
  const { openWorklogEditor } = useWorklogEditor();
  const { value: account } = useStoredValue('account');
  const { value: bookmarks } = useStoredValue('bookmarks');
  const [selectedIssue, setSelectedIssue] = useState<IssueSelection | null>(null);

  const handleAdd = async (): Promise<void> => {
    if (!selectedIssue) {
      return;
    }
    if (bookmarks.some((bookmark) => bookmark.issueKey === selectedIssue.key)) {
      notify(`${selectedIssue.key} já está nos favoritos.`, 'info');
    } else {
      await toggleBookmark(selectedIssue.key, selectedIssue.summary);
    }
    setSelectedIssue(null);
  };

  return (
    <div className={styles.organizationPage}>
      <PageHeader title="Favoritos" description="Issues que você usa sempre, a um clique do timer." />

      <SurfacePanel title="Adicionar favorito">
        <div className={styles.organizationPage__adder}>
          <IssuePicker value={selectedIssue} onChange={setSelectedIssue} />
          <ActionButton variant="primary" icon={Plus} disabled={!selectedIssue} onClick={() => void handleAdd()}>
            Favoritar
          </ActionButton>
        </div>
      </SurfacePanel>

      <SurfacePanel title={`${bookmarks.length} favoritos`}>
        {bookmarks.length === 0 ? (
          <EmptyState icon={Bookmark} title="Nenhum favorito ainda" description="Favorite issues recorrentes, como reuniões e suporte." />
        ) : (
          <ul className={styles.organizationPage__list}>
            <AnimatePresence initial={false}>
              {bookmarks.map((bookmark) => (
                <motion.li
                  key={bookmark.issueKey}
                  layout
                  className={styles.organizationPage__entry}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                >
                  <span className={styles.organizationPage__entryText}>
                    <span className={styles.organizationPage__entryKey}>{bookmark.issueKey}</span>
                    <span className={styles.organizationPage__entryTitle}>{bookmark.summary}</span>
                  </span>
                  <span className={styles.organizationPage__entryActions}>
                    {account && (
                      <ActionButton
                        variant="ghost"
                        isCompact
                        icon={ExternalLink}
                        label="Abrir no Jira"
                        onClick={() => window.open(`${account.baseUrl}/browse/${encodeURIComponent(bookmark.issueKey)}`, '_blank', 'noopener')}
                      />
                    )}
                    <ActionButton
                      variant="ghost"
                      isCompact
                      icon={Plus}
                      label="Registrar tempo"
                      onClick={() => openWorklogEditor({ draft: { issueKey: bookmark.issueKey, issueSummary: bookmark.summary } })}
                    />
                    <ActionButton
                      variant="ghost"
                      isCompact
                      icon={Play}
                      label="Iniciar timer"
                      onClick={() =>
                        void startTimer(bookmark.issueKey, bookmark.summary).then(() => notify(`Timer iniciado em ${bookmark.issueKey}.`))
                      }
                    />
                    <ActionButton
                      variant="ghost"
                      isCompact
                      icon={Trash2}
                      label="Remover"
                      onClick={() => void removeBookmark(bookmark.issueKey)}
                    />
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </SurfacePanel>
    </div>
  );
}
