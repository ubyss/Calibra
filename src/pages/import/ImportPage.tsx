import { Download, FileSpreadsheet, FileUp } from 'lucide-react';
import { motion } from 'motion/react';
import { type ChangeEvent, type DragEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { PageHeader } from '@/components/layout/PageHeader';
import { ActionButton } from '@/components/ui/ActionButton';
import { StatusTag } from '@/components/ui/ProgressMeter';
import { SurfacePanel } from '@/components/ui/SurfacePanel';
import { useToast } from '@/components/ui/ToastProvider';
import { JiraClient } from '@/services/jira-client';
import { createWorklogs } from '@/services/worklog-service';
import { downloadFile } from '@/utils/csv';
import { formatDuration } from '@/utils/duration';
import { classNames, getErrorMessage, mapWithConcurrency } from '@/utils/misc';

import styles from './ImportPage.module.css';
import { CSV_TEMPLATE, type ImportRow, parseWorklogCsv } from './worklog-csv';

async function validateIssues(rows: ImportRow[]): Promise<ImportRow[]> {
  const client = await JiraClient.fromStorage();
  const keys = [...new Set(rows.filter((row) => row.draft).map((row) => row.issueKey))];
  const summaries = new Map<string, string | null>();

  await mapWithConcurrency(keys, 4, async (key) => {
    try {
      summaries.set(key, (await client.getIssue(key)).summary);
    } catch {
      summaries.set(key, null);
    }
  });

  return rows.map((row) => {
    if (!row.draft) {
      return row;
    }
    const summary = summaries.get(row.issueKey);
    if (summary === null) {
      return { ...row, draft: null, errors: ['Issue não encontrada no Jira'] };
    }
    return { ...row, draft: { ...row.draft, issueSummary: summary } };
  });
}

export function ImportPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  const validRows = rows.filter((row) => row.draft);
  const invalidCount = rows.length - validRows.length;

  const readFile = async (file: File): Promise<void> => {
    setFileName(file.name);
    setIsValidating(true);
    try {
      const parsed = parseWorklogCsv(await file.text());
      setRows(parsed);
      setRows(await validateIssues(parsed));
    } catch (error) {
      notify(getErrorMessage(error), 'error');
    } finally {
      setIsValidating(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>): void => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) {
      void readFile(file);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file) {
      void readFile(file);
    }
    event.target.value = '';
  };

  const handleImport = async (): Promise<void> => {
    await createWorklogs(validRows.flatMap((row) => (row.draft ? [row.draft] : [])));
    notify(`${validRows.length} worklogs importados como pendentes.`);
    navigate('/worklogs');
  };

  return (
    <>
      <PageHeader
        title="Importar worklogs"
        description="Traga uma planilha CSV. Os registros entram como pendentes para você revisar antes de enviar."
        actions={
          <ActionButton icon={Download} onClick={() => downloadFile('modelo-worklogs.csv', CSV_TEMPLATE, 'text/csv')}>
            Baixar modelo
          </ActionButton>
        }
      />

      <SurfacePanel>
        <label
          className={classNames(styles.importPage__dropZone, isDragging && styles['importPage__dropZone--active'])}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <motion.span className={styles.importPage__dropIcon} animate={{ y: isDragging ? -6 : 0 }}>
            <FileUp aria-hidden />
          </motion.span>
          <span className={styles.importPage__dropTitle}>{fileName || 'Arraste um arquivo .csv ou clique para escolher'}</span>
          <span className={styles.importPage__dropHint}>
            Colunas: issue, data, inicio, duracao, comentario. Separador vírgula ou ponto e vírgula.
          </span>
          <input type="file" accept=".csv,text/csv" className="visuallyHidden" onChange={handleFileChange} />
        </label>

        {rows.length > 0 && (
          <>
            <div className={styles.importPage__summary}>
              <span className={styles.importPage__counts}>
                <StatusTag tone="success">{`${validRows.length} válidos`}</StatusTag>
                {invalidCount > 0 && <StatusTag tone="warning">{`${invalidCount} com problema`}</StatusTag>}
              </span>
              <ActionButton
                variant="primary"
                icon={FileSpreadsheet}
                disabled={validRows.length === 0}
                isLoading={isValidating}
                onClick={() => void handleImport()}
              >
                {isValidating ? 'Validando no Jira…' : `Importar ${validRows.length}`}
              </ActionButton>
            </div>

            <div className={styles.importPage__tableScroller}>
              <table className={styles.importPage__table}>
                <thead>
                  <tr>
                    <th>Linha</th>
                    <th>Issue</th>
                    <th>Data</th>
                    <th>Início</th>
                    <th>Duração</th>
                    <th>Comentário</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.line}>
                      <td>{row.line}</td>
                      <td>{row.issueKey || '—'}</td>
                      <td>{row.date || '—'}</td>
                      <td>{row.startTime}</td>
                      <td>{row.draft ? formatDuration(row.draft.durationSeconds) : row.durationText || '—'}</td>
                      <td className={styles.importPage__comment}>{row.comment}</td>
                      <td className={row.errors.length ? styles.importPage__rowError : undefined}>
                        {row.errors.length ? row.errors.join(', ') : 'Pronto'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </SurfacePanel>
    </>
  );
}
