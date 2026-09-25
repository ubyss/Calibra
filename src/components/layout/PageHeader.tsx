import type { ReactNode } from 'react';

import styles from './PageHeader.module.css';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className={styles.pageHeader}>
      <div>
        {eyebrow && <p className={styles.pageHeader__eyebrow}>{eyebrow}</p>}
        <h1 className={styles.pageHeader__title}>{title}</h1>
        {description && <p className={styles.pageHeader__description}>{description}</p>}
      </div>
      {actions && <div className={styles.pageHeader__actions}>{actions}</div>}
    </header>
  );
}
