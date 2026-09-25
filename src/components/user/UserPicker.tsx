import { AnimatePresence, motion } from 'motion/react';
import { useId, useState } from 'react';

import { TextInput } from '@/components/ui/FormField';
import { useAsync } from '@/hooks/useAsync';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { JiraClient } from '@/services/jira-client';
import type { JiraUserSummary } from '@/types/domain';

import styles from './UserPicker.module.css';

interface UserPickerProps {
  excludedIds: string[];
  onSelect: (user: JiraUserSummary) => void;
}

export function UserPicker({ excludedIds, onSelect }: UserPickerProps) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(query.trim(), 350);

  const search = useAsync(
    async () => (await JiraClient.fromStorage()).searchUsers(debouncedQuery),
    [debouncedQuery],
    debouncedQuery.length >= 2,
  );
  const results = (search.data ?? []).filter((user) => !excludedIds.includes(user.id));
  const shouldShowList = isOpen && debouncedQuery.length >= 2;

  return (
    <div className={styles.userPicker}>
      <TextInput
        value={query}
        placeholder="Adicionar pessoa pelo nome ou e-mail"
        aria-label="Buscar pessoa no Jira"
        role="combobox"
        aria-expanded={shouldShowList}
        aria-controls={listId}
        autoComplete="off"
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
      />
      <AnimatePresence>
        {shouldShowList && (
          <motion.ul
            id={listId}
            role="listbox"
            className={styles.userPicker__results}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
          >
            {results.map((user) => (
              <li
                key={user.id}
                role="option"
                aria-selected={false}
                className={styles.userPicker__option}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onSelect(user);
                  setQuery('');
                  setIsOpen(false);
                }}
              >
                <span>{user.displayName}</span>
                {user.email && <span className={styles.userPicker__optionEmail}>{user.email}</span>}
              </li>
            ))}
            {results.length === 0 && (
              <li className={styles.userPicker__notice}>
                {search.isLoading ? 'Buscando…' : search.error ?? 'Ninguém encontrado.'}
              </li>
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
