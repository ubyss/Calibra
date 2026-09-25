import { Search, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type KeyboardEvent, useId, useState } from 'react';

import { ActionButton } from '@/components/ui/ActionButton';
import { TextInput } from '@/components/ui/FormField';
import { resolveIssueTypeMark } from '@/utils/issue-type';
import { classNames } from '@/utils/misc';

import { IssueTypeIcon } from './IssueTypeIcon';
import styles from './IssuePicker.module.css';
import { type IssueSelection, useIssueSuggestions } from './useIssueSuggestions';

interface IssuePickerProps {
  value: IssueSelection | null;
  onChange: (issue: IssueSelection | null) => void;
  inputId?: string;
  placeholder?: string;
}

export function IssuePicker({ value, onChange, inputId, placeholder = 'Busque por chave ou texto…' }: IssuePickerProps) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const { suggestions, isSearching, error } = useIssueSuggestions(query);

  const selectIssue = (issue: IssueSelection): void => {
    onChange(issue);
    setQuery('');
    setIsOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((index) => Math.min(index + 1, suggestions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && isOpen && suggestions[highlightedIndex]) {
      event.preventDefault();
      selectIssue(suggestions[highlightedIndex]);
    } else if (event.key === 'Escape' && isOpen) {
      event.stopPropagation();
      setIsOpen(false);
    }
  };

  if (value) {
    const typeMark = resolveIssueTypeMark(value.issueTypeName);
    return (
      <motion.div
        className={styles.issuePicker__selected}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <span className={styles.issuePicker__selectedType} aria-hidden>
          <IssueTypeIcon mark={typeMark} iconUrl={value.issueTypeIconUrl} label={value.issueTypeName} />
        </span>
        <span className={styles.issuePicker__selectedText}>
          <span className={styles.issuePicker__optionKey}>{value.key}</span>
          <span className={styles.issuePicker__optionSummary}>{value.summary || 'Sem título'}</span>
        </span>
        <ActionButton variant="ghost" isCompact icon={X} label="Trocar issue" onClick={() => onChange(null)} />
      </motion.div>
    );
  }

  const showNotice = query.trim().length >= 2 && suggestions.length === 0;

  return (
    <div className={styles.issuePicker}>
      <div className={styles.issuePicker__search}>
        <Search className={styles.issuePicker__searchIcon} aria-hidden />
        <TextInput
          id={inputId}
          className={styles.issuePicker__input}
          value={query}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlightedIndex(0);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
          onKeyDown={handleKeyDown}
        />
      </div>
      <AnimatePresence>
        {isOpen && (suggestions.length > 0 || showNotice) && (
          <motion.ul
            id={listId}
            role="listbox"
            className={styles.issuePicker__suggestions}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {suggestions.map((issue, index) => {
              const typeMark = resolveIssueTypeMark(issue.issueTypeName);
              return (
                <li
                  key={issue.key}
                  role="option"
                  aria-selected={index === highlightedIndex}
                  className={classNames(
                    styles.issuePicker__option,
                    index === highlightedIndex && styles['issuePicker__option--highlighted'],
                  )}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    selectIssue(issue);
                  }}
                >
                  <span className={styles.issuePicker__optionType} aria-hidden>
                    <IssueTypeIcon mark={typeMark} iconUrl={issue.issueTypeIconUrl} label={issue.issueTypeName} />
                  </span>
                  <span className={styles.issuePicker__optionKey}>{issue.key}</span>
                  <span className={styles.issuePicker__optionSummary}>{issue.summary}</span>
                </li>
              );
            })}
            {showNotice && (
              <li className={styles.issuePicker__notice}>
                {isSearching ? 'Buscando no Jira…' : error ?? 'Nenhuma issue encontrada.'}
              </li>
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
