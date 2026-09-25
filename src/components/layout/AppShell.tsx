import { Menu } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { ActionButton } from '@/components/ui/ActionButton';

import { AppNavigation } from './AppNavigation';
import styles from './AppShell.module.css';

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => setIsDrawerOpen(false), [location.pathname]);

  return (
    <div className={styles.appShell}>
      <aside className={styles.appShell__sidebar}>
        <AppNavigation highlightId="sidebar-highlight" />
      </aside>

      <header className={styles.appShell__topBar}>
        <span className={styles.appShell__topBarTitle}>Timesheet</span>
        <ActionButton variant="ghost" icon={Menu} label="Abrir menu" onClick={() => setIsDrawerOpen(true)} />
      </header>

      <AnimatePresence>
        {isDrawerOpen && (
          <div className={styles.appShell__drawer}>
            <motion.div
              className={styles.appShell__drawerBackdrop}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
            />
            <motion.div
              className={styles.appShell__drawerPanel}
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            >
              <AppNavigation highlightId="drawer-highlight" onNavigate={() => setIsDrawerOpen(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          className={styles.appShell__main}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {children}
        </motion.main>
      </AnimatePresence>
    </div>
  );
}
