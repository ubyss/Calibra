import { Download } from 'lucide-react';

import { ActionButton } from '@/components/ui/ActionButton';
import { ModalDialog } from '@/components/ui/ModalDialog';
import { useExtensionUpdate } from '@/hooks/useExtensionUpdate';

import styles from './UpdateAvailableDialog.module.css';

export function UpdateAvailableDialog() {
  const { snapshot, snooze, openRepository } = useExtensionUpdate();

  if (!snapshot.shouldShowNotice || !snapshot.remoteVersion) {
    return null;
  }

  return (
    <ModalDialog
      isOpen
      title="Nova versão da extensão"
      description={`A ${snapshot.remoteVersion} está no GitHub. Neste navegador está a ${snapshot.localVersion}.`}
      onClose={() => void snooze()}
      footer={
        <>
          <ActionButton onClick={() => void snooze()}>Depois</ActionButton>
          <ActionButton variant="primary" icon={Download} onClick={openRepository}>
            Ver no GitHub
          </ActionButton>
        </>
      }
    >
      <ol className={styles.updateAvailableDialog__steps}>
        <li>Atualize o código do repositório Calibra.</li>
        <li>Rode o build para gerar a pasta dist.</li>
        <li>Em chrome://extensions, clique em Atualizar nesta extensão.</li>
      </ol>
    </ModalDialog>
  );
}
