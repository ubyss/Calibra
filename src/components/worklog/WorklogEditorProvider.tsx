import { Send, Trash2 } from 'lucide-react';
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';

import { ActionButton } from '@/components/ui/ActionButton';
import { ModalDialog } from '@/components/ui/ModalDialog';
import { useToast } from '@/components/ui/ToastProvider';
import { useStoredValue } from '@/hooks/useStoredValue';
import { createWorklog, deleteWorklog, updateWorklog, uploadWorklogs } from '@/services/worklog-service';
import type { Worklog, WorklogDraft } from '@/types/domain';
import { getErrorMessage } from '@/utils/misc';

import {
  toFormValues,
  validateWorklogForm,
  type WorklogFormValidation,
  type WorklogFormValues,
  WorklogEditorForm,
} from './WorklogEditorForm';
import styles from './WorklogEditorForm.module.css';

interface OpenEditorOptions {
  worklog?: Worklog;
  draft?: Partial<WorklogDraft>;
}

interface WorklogEditorApi {
  openWorklogEditor: (options?: OpenEditorOptions) => void;
}

const WorklogEditorContext = createContext<WorklogEditorApi | null>(null);

export function WorklogEditorProvider({ children }: { children: ReactNode }) {
  const { notify } = useToast();
  const { value: settings } = useStoredValue('settings');
  const [isOpen, setIsOpen] = useState(false);
  const [editingWorklog, setEditingWorklog] = useState<Worklog | null>(null);
  const [values, setValues] = useState<WorklogFormValues>(() => toFormValues({}));
  const [errors, setErrors] = useState<WorklogFormValidation['errors']>({});
  const [busyAction, setBusyAction] = useState<'save' | 'upload' | 'delete' | null>(null);

  const openWorklogEditor = useCallback((options: OpenEditorOptions = {}) => {
    setEditingWorklog(options.worklog ?? null);
    setValues(toFormValues(options.worklog ?? options.draft ?? {}));
    setErrors({});
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const persist = async (shouldUpload: boolean): Promise<void> => {
    const { draft, errors: validationErrors } = validateWorklogForm(values);
    setErrors(validationErrors);
    if (!draft) {
      return;
    }

    setBusyAction(shouldUpload ? 'upload' : 'save');
    try {
      let worklogId = editingWorklog?.id;
      if (editingWorklog) {
        await updateWorklog(editingWorklog.id, draft);
      } else {
        worklogId = (await createWorklog(draft)).id;
      }

      if (shouldUpload && worklogId) {
        const result = await uploadWorklogs([worklogId]);
        if (result.failures.length) {
          notify(result.failures[0].message, 'error');
          return;
        }
        notify('Worklog enviado ao Jira.');
      } else if (settings.autoUploadWorklogs) {
        notify('Worklog salvo.');
      } else {
        notify(editingWorklog?.jiraWorklogId ? 'Alteração salva. Envie para atualizar no Jira.' : 'Worklog salvo.');
      }
      setIsOpen(false);
    } catch (error) {
      notify(getErrorMessage(error), 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!editingWorklog) {
      return;
    }
    const message = editingWorklog.jiraWorklogId
      ? 'Este worklog também será removido do Jira. Continuar?'
      : 'Excluir este worklog?';
    if (!window.confirm(message)) {
      return;
    }

    setBusyAction('delete');
    try {
      await deleteWorklog(editingWorklog);
      notify('Worklog excluído.');
      setIsOpen(false);
    } catch (error) {
      notify(getErrorMessage(error), 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const api = useMemo(() => ({ openWorklogEditor }), [openWorklogEditor]);

  return (
    <WorklogEditorContext.Provider value={api}>
      {children}
      <ModalDialog
        isOpen={isOpen}
        onClose={close}
        title={editingWorklog ? 'Editar worklog' : 'Novo worklog'}
        description={editingWorklog?.jiraWorklogId ? 'Já enviado ao Jira. Ao salvar, ele volta para pendente.' : undefined}
        footer={
          <>
            {editingWorklog && (
              <ActionButton variant="danger" icon={Trash2} isLoading={busyAction === 'delete'} onClick={handleDelete}>
                Excluir
              </ActionButton>
            )}
            <span className={styles.worklogEditorForm__footerSpacer} />
            <ActionButton icon={Send} isLoading={busyAction === 'upload'} onClick={() => void persist(true)}>
              Salvar e enviar
            </ActionButton>
            <ActionButton variant="primary" isLoading={busyAction === 'save'} onClick={() => void persist(false)}>
              Salvar
            </ActionButton>
          </>
        }
      >
        <WorklogEditorForm values={values} errors={errors} onChange={setValues} />
      </ModalDialog>
    </WorklogEditorContext.Provider>
  );
}

export function useWorklogEditor(): WorklogEditorApi {
  const context = useContext(WorklogEditorContext);
  if (!context) {
    throw new Error('useWorklogEditor precisa estar dentro de WorklogEditorProvider.');
  }
  return context;
}
