import type { LucideIcon } from 'lucide-react';
import { type HTMLMotionProps, motion } from 'motion/react';
import type { ReactNode } from 'react';

import { classNames } from '@/utils/misc';

import styles from './ActionButton.module.css';

type ActionButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ActionButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: ActionButtonVariant;
  icon?: LucideIcon;
  isCompact?: boolean;
  isLoading?: boolean;
  label?: string;
  children?: ReactNode;
}

export function ActionButton({
  variant = 'secondary',
  icon: Icon,
  isCompact = false,
  isLoading = false,
  label,
  children,
  className,
  disabled,
  type = 'button',
  ...buttonProps
}: ActionButtonProps) {
  const isIconOnly = !children;

  return (
    <motion.button
      type={type}
      whileTap={disabled || isLoading ? undefined : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 600, damping: 30 }}
      className={classNames(
        styles.actionButton,
        styles[`actionButton--${variant}`],
        isCompact && styles['actionButton--compact'],
        isIconOnly && styles['actionButton--iconOnly'],
        className,
      )}
      disabled={disabled || isLoading}
      aria-label={isIconOnly ? label : undefined}
      title={isIconOnly ? label : undefined}
      aria-busy={isLoading || undefined}
      {...buttonProps}
    >
      {isLoading ? (
        <span className={styles.actionButton__spinner} aria-hidden />
      ) : (
        Icon && <Icon className={styles.actionButton__icon} aria-hidden strokeWidth={2.2} />
      )}
      {children}
    </motion.button>
  );
}
