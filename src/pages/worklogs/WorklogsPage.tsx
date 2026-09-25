import { endOfMonth, endOfWeek, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { Archive, ListChecks, Plus, Trash2, UploadCloud } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';

import { PageHeader } from '@/components/layout/PageHeader';
import { ActionButton } from '@/components/ui/ActionButton';
import { EmptyState } from '@/components/ui/FeedbackStates';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SurfacePanel } from '@/components/ui/SurfacePanel';
import { useToast } from '@/components/ui/ToastProvider';
import { useWorklogEditor } from '@/components/worklog/WorklogEditorProvider';
import { WorklogList } from '@/components/worklog/WorklogList';
import { useStoredValue } from '@/hooks/useStoredValue';
import { useWorklogUpload } from '@/hooks/useWorklogUpload';
import { updateStorage } from '@/services/storage';
import { deleteWorklog } from '@/services/worklog-service';
import type { Worklog, WorklogStatus } from '@/types/domain';
import { formatDuration } from '@/utils/duration';
import { getErrorMessage } from '@/utils/misc';

import styles from './WorklogsPage.module.css';

type StatusFilter = WorklogStatus | 'all';
type PeriodFilter = 'week' | 'month' | 'all';

function isInPeriod(worklog: Worklog, period: PeriodFilter, now: Date): boolean {
  switch (period) {
    case 'all':
      return true;
    case 'week': {
      const started = parseISO(worklog.startedAt);
      return started >= startOfWeek(now, { weekStartsOn: 1 }) && started <= endOfWeek(now, { weekStartsOn: 1 });
    }
    case 'month': {
      const started = parseISO(worklog.startedAt);
      return started >= startOfMonth(now) && started <= endOfMonth(now);
    }
    default: {
      const unhandled: never = period;
      return unhandled;
    }
  }
}

export function WorklogsPage() {
  const { notify } = useToast();
  const { openWorklogEditor } = useWorklogEditor();
  const { value: worklogs } = useStoredValue('worklogs');
  const { upload, isUploading } = useWorklogUpload();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const visibleWorklogs = useMemo(() => {
    const now = new Date();
    return worklogs.filter(
      (worklog) =>
        (statusFilter === 'all' || worklog.status === statusFilter) && isInPeriod(worklog, periodFilter, now),
    );
  }, [worklogs, statusFilter, periodFilter]);

  const selectedWorklogs = visibleWorklogs.filter((worklog) => selectedIds.has(worklog.id));
  const totalSeconds = visibleWorklogs.reduce((sum, worklog) => sum + worklog.durationSeconds, 0);

  const toggleSelection = (id: string): void => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleUploadSelected = async (): Promise<void> => {
    await upload(selectedWorklogs.map((worklog) => worklog.id));
    setSelectedIds(new Set());
  };

  const handleDeleteSelected = async (): Promise<void> => {
    const uploadedCount = selectedWorklogs.filter((worklog) => worklog.jiraWorklogId).length;
    const warning = uploadedCount > 0 ? ` ${uploadedCount} deles também serão removidos do Jira.` : '';
    if (!window.confirm(`Excluir ${selectedWorklogs.length} worklog(s)?${warning}`)) {
      return;
    }
    try {
      for (const worklog of selectedWorklogs) {
        await deleteWorklog(worklog);
      }
      notify('Worklogs excluídos.');
      setSelectedIds(new Set());
    } catch (error) {
      notify(getErrorMessage(error), 'error');
    }
  };

  const handleArchiveUploaded = async (): Promise<void> => {
    if (!window.confirm('Remover do histórico local os worklogs já enviados? Eles continuam no Jira.')) {
      return;
    }
    await updateStorage('worklogs', (current) => current.filter((worklog) => worklog.status !== 'uploaded'));
    notify('Histórico local limpo.');
  };

  return (
    <>
      <PageHeader
        title="Worklogs"
        description="Tudo o que você registrou por aqui. Pendentes ficam só no seu navegador até você enviar."
        actions={
          <>
            <ActionButton variant="ghost" icon={Archive} onClick={() => void handleArchiveUploaded()}>
              Limpar enviados
            </ActionButton>
            <ActionButton variant="primary" icon={Plus} onClick={() => openWorklogEditor()}>
              Novo worklog
            </ActionButton>
          </>
        }
      />

      <SurfacePanel>
        <div className={styles.worklogsPage__toolbar}>
          <div className={styles.worklogsPage__filters}>
            <SegmentedControl
              ariaLabel="Status"
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                setSelectedIds(new Set());
              }}
              options={[
                { value: 'pending', label: 'Pendentes' },
                { value: 'uploaded', label: 'Enviados' },
                { value: 'all', label: 'Todos' },
              ]}
            />
            <SegmentedControl
              ariaLabel="Período"
              value={periodFilter}
              onChange={setPeriodFilter}
              options={[
                { value: 'week', label: 'Semana' },
                { value: 'month', label: 'Mês' },
                { value: 'all', label: 'Tudo' },
              ]}
            />
          </div>
          <span className={styles.worklogsPage__summary}>
            {visibleWorklogs.length} registros · {formatDuration(totalSeconds)}
          </span>
        </div>

        {visibleWorklogs.length > 0 ? (
          <>
            <ActionButton
              variant="ghost"
              isCompact
              icon={ListChecks}
              className={styles.worklogsPage__selectAll}
              onClick={() =>
                setSelectedIds(
                  selectedWorklogs.length === visibleWorklogs.length
                    ? new Set()
                    : new Set(visibleWorklogs.map((worklog) => worklog.id)),
                )
              }
            >
              {selectedWorklogs.length === visibleWorklogs.length ? 'Limpar seleção' : 'Selecionar todos'}
            </ActionButton>
            <WorklogList worklogs={visibleWorklogs} selectedIds={selectedIds} onToggleSelection={toggleSelection} />
          </>
        ) : (
          <EmptyState
            icon={ListChecks}
            title="Nenhum worklog por aqui"
            description="Use o timer ou crie um registro manual para começar."
          />
        )}
      </SurfacePanel>

      <AnimatePresence>
        {selectedWorklogs.length > 0 && (
          <motion.div
            className={styles.worklogsPage__selectionBar}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          >
            <span>
              {selectedWorklogs.length} selecionado(s) ·{' '}
              {formatDuration(selectedWorklogs.reduce((sum, worklog) => sum + worklog.durationSeconds, 0))}
            </span>
            <span className={styles.worklogsPage__selectionActions}>
              <ActionButton variant="danger" isCompact icon={Trash2} onClick={() => void handleDeleteSelected()}>
                Excluir
              </ActionButton>
              <ActionButton
                variant="primary"
                isCompact
                icon={UploadCloud}
                isLoading={isUploading}
                onClick={() => void handleUploadSelected()}
              >
                Enviar ao Jira
              </ActionButton>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
