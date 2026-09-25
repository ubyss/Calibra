import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';

import { createId } from '@/utils/misc';

import styles from './ToastProvider.module.css';

type ToastTone = 'success' | 'error' | 'info';

interface ToastMessage {
  id: string;
  tone: ToastTone;
  text: string;
}

interface ToastApi {
  notify: (text: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const TOAST_DURATION_MS = 4200;

const TONE_ICONS = {
  success: CircleCheck,
  error: CircleAlert,
  info: Info,
} satisfies Record<ToastTone, typeof Info>;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const notify = useCallback((text: string, tone: ToastTone = 'success') => {
    const id = createId();
    setMessages((current) => [...current.slice(-2), { id, tone, text }]);
    window.setTimeout(() => setMessages((current) => current.filter((message) => message.id !== id)), TOAST_DURATION_MS);
  }, []);

  const api = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.toastStack} role="status" aria-live="polite">
        <AnimatePresence initial={false}>
          {messages.map((message) => {
            const Icon = TONE_ICONS[message.tone];
            return (
              <motion.div
                key={message.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
                transition={{ type: 'spring', stiffness: 480, damping: 34 }}
                className={`${styles.toastStack__message} ${styles[`toastStack__message--${message.tone}`]}`}
              >
                <Icon className={styles.toastStack__icon} aria-hidden />
                <span>{message.text}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast precisa estar dentro de ToastProvider.');
  }
  return context;
}
