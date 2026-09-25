import { motion } from 'motion/react';
import { useId } from 'react';

import { classNames } from '@/utils/misc';

import styles from './SegmentedControl.module.css';

export interface SegmentedOption<TValue extends string> {
  value: TValue;
  label: string;
}

interface SegmentedControlProps<TValue extends string> {
  options: SegmentedOption<TValue>[];
  value: TValue;
  onChange: (value: TValue) => void;
  ariaLabel: string;
}

export function SegmentedControl<TValue extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedControlProps<TValue>) {
  const layoutId = useId();

  return (
    <div className={styles.segmentedControl} role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            className={classNames(styles.segmentedControl__option, isActive && styles['segmentedControl__option--active'])}
            onClick={() => onChange(option.value)}
          >
            {isActive && (
              <motion.span
                layoutId={layoutId}
                className={styles.segmentedControl__highlight}
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className={styles.segmentedControl__label}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
