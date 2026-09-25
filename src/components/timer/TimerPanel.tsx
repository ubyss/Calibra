import { Pause, Play, Square, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';

import { IssuePicker } from '@/components/issue/IssuePicker';
import type { IssueSelection } from '@/components/issue/useIssueSuggestions';
import { ActionButton } from '@/components/ui/ActionButton';
import { TextInput } from '@/components/ui/FormField';
import { useToast } from '@/components/ui/ToastProvider';
import { useRunningTimer } from '@/hooks/useRunningTimer';
import { useStoredValue } from '@/hooks/useStoredValue';
import {
  discardTimer,
  pauseTimer,
  resumeTimer,
  startTimer,
  stopTimer,
  updateTimerComment,
} from '@/services/timer-service';
import { formatDuration } from '@/utils/duration';
import { classNames, getErrorMessage } from '@/utils/misc';

import { TimerDial } from './TimerDial';
import styles from './TimerPanel.module.css';

const SWAP_TRANSITION = { duration: 0.25, ease: [0.2, 0.8, 0.2, 1] as const };

export function TimerPanel() {
  const { notify } = useToast();
  const { value: settings } = useStoredValue('settings');
  const { timer, elapsedSeconds, isRunning } = useRunningTimer();
  const [selectedIssue, setSelectedIssue] = useState<IssueSelection | null>(null);
  const [comment, setComment] = useState('');

  useEffect(() => setComment(timer?.comment ?? ''), [timer?.startedAt, timer?.comment]);

  const run = async (action: () => Promise<unknown>, successMessage?: string): Promise<void> => {
    try {
      await action();
      if (successMessage) {
        notify(successMessage);
      }
    } catch (error) {
      notify(getErrorMessage(error), 'error');
    }
  };

  const handleStart = (): void => {
    if (!selectedIssue) {
      return;
    }
    void run(() => startTimer(selectedIssue.key, selectedIssue.summary));
    setSelectedIssue(null);
  };

  const handleStop = (): void => {
    void run(async () => {
      await updateTimerComment(comment);
      const worklog = await stopTimer();
      if (worklog) {
        notify(
          settings.autoUploadWorklogs
            ? 'Worklog salvo.'
            : `${formatDuration(worklog.durationSeconds)} salvos em ${worklog.issueKey}. Envie quando quiser.`,
        );
      }
    });
  };

  const handleDiscard = (): void => {
    if (window.confirm('Descartar o tempo cronometrado?')) {
      void run(discardTimer, 'Timer descartado.');
    }
  };

  return (
    <div className={classNames(styles.timerPanel, timer && !isRunning && styles['timerPanel--paused'])}>
      <AnimatePresence mode="wait" initial={false}>
        {timer ? (
          <motion.div
            key="active"
            className={styles.timerPanel}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={SWAP_TRANSITION}
          >
            <div className={styles.timerPanel__active}>
              <TimerDial elapsedSeconds={elapsedSeconds} isRunning={isRunning} />
              <div className={styles.timerPanel__details}>
                <span className={styles.timerPanel__issueKey}>{timer.issueKey}</span>
                <span className={styles.timerPanel__issueSummary}>{timer.issueSummary || 'Sem título'}</span>
                <span className={styles.timerPanel__state}>
                  {isRunning ? 'Cronometrando' : timer.isAutoPaused ? 'Pausado automaticamente' : 'Pausado'}
                </span>
              </div>
            </div>
            <TextInput
              value={comment}
              placeholder="Comentário do worklog (opcional)"
              aria-label="Comentário do worklog"
              onChange={(event) => setComment(event.target.value)}
              onBlur={() => void updateTimerComment(comment)}
            />
            <div className={styles.timerPanel__controls}>
              {isRunning ? (
                <ActionButton icon={Pause} onClick={() => void run(() => pauseTimer())}>
                  Pausar
                </ActionButton>
              ) : (
                <ActionButton icon={Play} onClick={() => void run(() => resumeTimer())}>
                  Retomar
                </ActionButton>
              )}
              <ActionButton variant="primary" icon={Square} className={styles.timerPanel__controlsGrow} onClick={handleStop}>
                Parar e salvar
              </ActionButton>
              <ActionButton variant="ghost" icon={Trash2} label="Descartar timer" onClick={handleDiscard} />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            className={styles.timerPanel__starter}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={SWAP_TRANSITION}
          >
            <IssuePicker value={selectedIssue} onChange={setSelectedIssue} placeholder="Em que você vai trabalhar?" />
            <ActionButton variant="primary" icon={Play} disabled={!selectedIssue} onClick={handleStart}>
              Iniciar timer
            </ActionButton>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
