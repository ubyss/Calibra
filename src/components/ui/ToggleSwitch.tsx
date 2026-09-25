import { motion } from 'motion/react';

import { classNames } from '@/utils/misc';

import styles from './ToggleSwitch.module.css';

interface ToggleSwitchProps {
  title: string;
  description?: string;
  isChecked: boolean;
  onChange: (isChecked: boolean) => void;
}

export function ToggleSwitch({ title, description, isChecked, onChange }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isChecked}
      className={classNames(styles.toggleSwitch, isChecked && styles['toggleSwitch--checked'])}
      onClick={() => onChange(!isChecked)}
    >
      <span className={styles.toggleSwitch__text}>
        <span className={styles.toggleSwitch__title}>{title}</span>
        {description && <span className={styles.toggleSwitch__description}>{description}</span>}
      </span>
      <span className={styles.toggleSwitch__track} aria-hidden>
        <motion.span layout transition={{ type: 'spring', stiffness: 700, damping: 35 }} className={styles.toggleSwitch__knob} />
      </span>
    </button>
  );
}
