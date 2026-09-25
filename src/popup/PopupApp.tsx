import { Clock3, ExternalLink, UploadCloud } from 'lucide-react';
import { motion, MotionConfig } from 'motion/react';

import { TimerPanel } from '@/components/timer/TimerPanel';
import { ActionButton } from '@/components/ui/ActionButton';
import { ProgressMeter } from '@/components/ui/ProgressMeter';
import { ToastProvider, useToast } from '@/components/ui/ToastProvider';
import { useStoredValue } from '@/hooks/useStoredValue';
import { useTheme } from '@/hooks/useTheme';
import { useWeekTotals } from '@/hooks/useWeekTotals';
import { useWorklogUpload } from '@/hooks/useWorklogUpload';
import { sendToBackground } from '@/services/messaging';
import { startTimer } from '@/services/timer-service';
import { formatDuration } from '@/utils/duration';

import styles from './PopupApp.module.css';

const FAVORITES_LIMIT = 6;

function openApp(path: string): void {
  void sendToBackground({ type: 'app:open', path }).finally(() => window.close());
}

function PopupContent() {
  const { notify } = useToast();
  const { value: account, isLoaded } = useStoredValue('account');
  const { value: settings } = useStoredValue('settings');
  const { value: worklogs } = useStoredValue('worklogs');
  const { value: bookmarks } = useStoredValue('bookmarks');
  const { value: timer } = useStoredValue('timer');
  const totals = useWeekTotals(worklogs);
  const { upload, isUploading } = useWorklogUpload();
  const pendingIds = worklogs.filter((worklog) => worklog.status === 'pending').map((worklog) => worklog.id);

  if (!isLoaded) {
    return null;
  }

  if (!account) {
    return (
      <motion.div className={`${styles.popupApp__card} ${styles.popupApp__welcome}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <strong>Bem-vindo ao Timesheet</strong>
        <p className={styles.popupApp__welcomeText}>Conecte sua conta do Jira para começar a cronometrar.</p>
        <ActionButton variant="primary" onClick={() => openApp('/conectar')}>
          Conectar ao Jira
        </ActionButton>
      </motion.div>
    );
  }

  return (
    <>
      <section className={styles.popupApp__card} aria-label="Timer">
        <TimerPanel />
      </section>

      <section className={styles.popupApp__card} aria-label="Resumo de hoje">
        <div className={styles.popupApp__todayRow}>
          <span>Hoje</span>
          <span>
            <span className={styles.popupApp__todayValue}>{formatDuration(totals.todaySeconds)}</span> / {settings.dailyTargetHours}h
          </span>
        </div>
        <ProgressMeter value={totals.todaySeconds} max={settings.dailyTargetHours * 3600} label="Progresso do dia" isThin />
        {pendingIds.length > 0 && (
          <div className={styles.popupApp__pending}>
            <span>{pendingIds.length} pendente(s) de envio</span>
            <ActionButton isCompact icon={UploadCloud} isLoading={isUploading} onClick={() => void upload(pendingIds)}>
              Enviar
            </ActionButton>
          </div>
        )}
      </section>

      {!timer && bookmarks.length > 0 && (
        <section className={styles.popupApp__card} aria-label="Favoritos">
          <span className={styles.popupApp__sectionTitle}>Iniciar em um favorito</span>
          <div className={styles.popupApp__favorites}>
            {bookmarks.slice(0, FAVORITES_LIMIT).map((bookmark) => (
              <motion.button
                key={bookmark.issueKey}
                type="button"
                className={styles.popupApp__favorite}
                title={bookmark.summary}
                whileTap={{ scale: 0.95 }}
                onClick={() =>
                  void startTimer(bookmark.issueKey, bookmark.summary).then(() => notify(`Timer iniciado em ${bookmark.issueKey}.`))
                }
              >
                {bookmark.issueKey}
              </motion.button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export function PopupApp() {
  useTheme();

  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <div className={styles.popupApp}>
          <header className={styles.popupApp__header}>
            <span className={styles.popupApp__brand}>
              <span className={styles.popupApp__logo}>
                <Clock3 size={15} strokeWidth={2.4} aria-hidden />
              </span>
              Timesheet
            </span>
            <ActionButton variant="ghost" isCompact icon={ExternalLink} onClick={() => openApp('/')}>
              Abrir painel
            </ActionButton>
          </header>
          <PopupContent />
        </div>
      </ToastProvider>
    </MotionConfig>
  );
}
