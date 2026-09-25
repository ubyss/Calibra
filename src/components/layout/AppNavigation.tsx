import { Clock3 } from 'lucide-react';
import { motion } from 'motion/react';
import { NavLink } from 'react-router-dom';

import { NAVIGATION_SECTIONS, type NavigationLink, SETTINGS_LINK } from '@/constants/navigation';
import { useStoredValue } from '@/hooks/useStoredValue';
import { classNames, getInitials } from '@/utils/misc';

import styles from './AppNavigation.module.css';

interface AppNavigationProps {
  highlightId: string;
  onNavigate?: () => void;
}

function NavigationItem({
  link,
  highlightId,
  badge,
  onNavigate,
}: {
  link: NavigationLink;
  highlightId: string;
  badge?: number;
  onNavigate?: () => void;
}) {
  const Icon = link.icon;
  return (
    <NavLink
      to={link.path}
      end={link.path === '/'}
      onClick={onNavigate}
      className={({ isActive }) => classNames(styles.appNavigation__link, isActive && styles['appNavigation__link--active'])}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId={highlightId}
              className={styles.appNavigation__linkHighlight}
              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
            />
          )}
          <Icon className={styles.appNavigation__linkIcon} aria-hidden />
          <span className={styles.appNavigation__linkLabel}>{link.label}</span>
          {Boolean(badge) && (
            <span className={styles.appNavigation__linkBadge} aria-label={`${badge} pendentes`}>
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export function AppNavigation({ highlightId, onNavigate }: AppNavigationProps) {
  const { value: account } = useStoredValue('account');
  const { value: worklogs } = useStoredValue('worklogs');
  const pendingCount = worklogs.filter((worklog) => worklog.status === 'pending').length;

  return (
    <nav className={styles.appNavigation} aria-label="Navegação principal">
      <div className={styles.appNavigation__brand}>
        <span className={styles.appNavigation__logo}>
          <Clock3 size={18} strokeWidth={2.4} aria-hidden />
        </span>
        <span>
          <span className={styles.appNavigation__brandName}>Timesheet</span>
          <br />
          <span className={styles.appNavigation__brandTagline}>Seus dados ficam aqui</span>
        </span>
      </div>

      <div className={styles.appNavigation__sections}>
        {NAVIGATION_SECTIONS.map((section) => (
          <div key={section.title} className={styles.appNavigation__section}>
            <span className={styles.appNavigation__sectionTitle}>{section.title}</span>
            {section.links.map((link) => (
              <NavigationItem
                key={link.path}
                link={link}
                highlightId={highlightId}
                onNavigate={onNavigate}
                badge={link.path === '/worklogs' ? pendingCount : undefined}
              />
            ))}
          </div>
        ))}
      </div>

      <div className={styles.appNavigation__footer}>
        <NavigationItem link={SETTINGS_LINK} highlightId={highlightId} onNavigate={onNavigate} />
        {account && (
          <div className={styles.appNavigation__account}>
            <span className={styles.appNavigation__avatar} aria-hidden>
              {getInitials(account.user.displayName)}
            </span>
            <span className={styles.appNavigation__accountText}>
              <span className={styles.appNavigation__accountName}>{account.user.displayName}</span>
              <span className={styles.appNavigation__accountHost}>{new URL(account.baseUrl).host}</span>
            </span>
          </div>
        )}
      </div>
    </nav>
  );
}
