import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

import { classNames } from '@/utils/misc';

import { ActionButton } from './ActionButton';
import styles from './ModalDialog.module.css';

interface ModalDialogProps {
  isOpen: boolean;
  title: string;
  description?: string;
  isWide?: boolean;
  footer?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

const FOCUSABLE_SELECTOR = 'input, select, textarea, button:not([data-modal-close])';

export function ModalDialog({ isOpen, title, description, isWide, footer, onClose, children }: ModalDialogProps) {
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onCloseRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    requestAnimationFrame(() => sheetRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus());

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className={styles.modalDialog}>
          <motion.div
            className={styles.modalDialog__backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={classNames(styles.modalDialog__sheet, isWide && styles['modalDialog__sheet--wide'])}
            initial={{ opacity: 0, y: 32, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          >
            <header className={styles.modalDialog__header}>
              <div>
                <h2 id={titleId} className={styles.modalDialog__title}>
                  {title}
                </h2>
                {description && <p className={styles.modalDialog__description}>{description}</p>}
              </div>
              <ActionButton variant="ghost" icon={X} label="Fechar" isCompact onClick={onClose} data-modal-close />
            </header>
            {children}
            {footer && <footer className={styles.modalDialog__footer}>{footer}</footer>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
