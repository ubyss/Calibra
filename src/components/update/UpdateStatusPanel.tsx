import { RefreshCw } from 'lucide-react';

import { ActionButton } from '@/components/ui/ActionButton';
import { SurfacePanel } from '@/components/ui/SurfacePanel';
import { useExtensionUpdate } from '@/hooks/useExtensionUpdate';

import styles from './UpdateStatusPanel.module.css';

export function UpdateStatusPanel() {
  const { snapshot, isChecking, errorMessage, checkNow, openRepository } = useExtensionUpdate();
  const remoteLabel = snapshot.remoteVersion ?? 'ainda não consultada';

  return (
    <SurfacePanel
      title="Atualização"
      subtitle="A versão publicada fica no repositório Calibra."
      actions={
        <ActionButton icon={RefreshCw} isLoading={isChecking} onClick={() => void checkNow()}>
          Verificar
        </ActionButton>
      }
    >
      <dl className={styles.updateStatusPanel__versions}>
        <div>
          <dt>Instalada</dt>
          <dd>{snapshot.localVersion}</dd>
        </div>
        <div>
          <dt>No GitHub</dt>
          <dd>{remoteLabel}</dd>
        </div>
      </dl>
      {snapshot.isUpdateAvailable && (
        <p className={styles.updateStatusPanel__notice}>
          Há uma versão mais nova.{' '}
          <button type="button" className={styles.updateStatusPanel__link} onClick={openRepository}>
            Abrir o repositório
          </button>
        </p>
      )}
      {errorMessage && <p className={styles.updateStatusPanel__error}>{errorMessage}</p>}
    </SurfacePanel>
  );
}
