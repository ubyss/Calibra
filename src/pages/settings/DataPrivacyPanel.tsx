import { Download, Trash2, Upload } from 'lucide-react';
import { type ChangeEvent, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { ActionButton } from '@/components/ui/ActionButton';
import { SurfacePanel } from '@/components/ui/SurfacePanel';
import { useToast } from '@/components/ui/ToastProvider';
import { disconnectAccount } from '@/services/account-service';
import { createBackup, restoreBackup } from '@/services/backup-service';
import { clearAllStorage } from '@/services/storage';
import { downloadFile } from '@/utils/csv';
import { toDateKey } from '@/utils/date';
import { getErrorMessage } from '@/utils/misc';

import styles from './SettingsPage.module.css';

export function DataPrivacyPanel() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async (): Promise<void> => {
    downloadFile(`timesheet-backup-${toDateKey(new Date())}.json`, await createBackup(), 'application/json');
    notify('Backup gerado. O arquivo não contém tokens.');
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !window.confirm('Restaurar este backup substitui worklogs, favoritos, grupos e preferências atuais. Continuar?')) {
      return;
    }
    try {
      await restoreBackup(await file.text());
      notify('Backup restaurado.');
    } catch (error) {
      notify(getErrorMessage(error), 'error');
    }
  };

  const handleWipe = async (): Promise<void> => {
    if (!window.confirm('Apagar todos os dados locais e desconectar? Worklogs pendentes serão perdidos.')) {
      return;
    }
    await disconnectAccount();
    await clearAllStorage();
    navigate('/conectar');
  };

  return (
    <SurfacePanel title="Privacidade e dados" subtitle="Você tem o controle total.">
      <ul className={styles.settingsPage__privacyList}>
        <li>Nenhum analytics, telemetria ou relatório de erro é enviado.</li>
        <li>A extensão só faz requisições para o endereço do seu Jira.</li>
        <li>Tokens ficam criptografados (AES-GCM) e nunca entram no backup.</li>
      </ul>
      <div className={styles.settingsPage__actions}>
        <ActionButton icon={Download} onClick={() => void handleExport()}>
          Exportar backup
        </ActionButton>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="visuallyHidden"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => void handleImport(event)}
        />
        <ActionButton icon={Upload} onClick={() => fileInputRef.current?.click()}>
          Restaurar backup
        </ActionButton>
        <ActionButton variant="danger" icon={Trash2} onClick={() => void handleWipe()}>
          Apagar tudo
        </ActionButton>
      </div>
    </SurfacePanel>
  );
}
