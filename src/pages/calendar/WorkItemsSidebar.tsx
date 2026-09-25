import { ListFilter, PanelLeftClose, Star } from 'lucide-react';
import { type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';

import { IssueTypeIcon } from '@/components/issue/IssueTypeIcon';
import { ActionButton } from '@/components/ui/ActionButton';
import { ErrorNotice, LoadingSkeleton } from '@/components/ui/FeedbackStates';
import { TextInput } from '@/components/ui/FormField';
import { StatusTag, type StatusTagTone } from '@/components/ui/ProgressMeter';
import { ISSUE_KEY_PATTERN, MY_OPEN_ISSUES_JQL, RECENT_ISSUES_JQL } from '@/constants/defaults';
import { useAsync } from '@/hooks/useAsync';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useStoredValue } from '@/hooks/useStoredValue';
import { toggleBookmark } from '@/services/bookmark-service';
import { JiraClient } from '@/services/jira-client';
import { quoteJql } from '@/services/jira-mappers';
import type { JiraIssue, JiraStatusCategory } from '@/types/jira';
import { resolveIssueTypeMark } from '@/utils/issue-type';
import { classNames } from '@/utils/misc';

import { projectColorFromKey } from './calendar-model';
import styles from './WorkItemsSidebar.module.css';

type WorkItemsTab = 'recent' | 'assigned' | 'favorites';

type WorkItemsSidebarProps = {
  isCollapsible?: boolean;
  variant?: 'sidebar' | 'inline';
  onCollapse?: () => void;
  onSelectIssue: (issue: JiraIssue) => void;
  onDragIssue: (issue: JiraIssue, pointer: { x: number; y: number }) => void;
};

const STATUS_WITHOUT_LABEL = 'Sem status';
const DRAG_THRESHOLD_PX = 4;

const STATUS_TONES: Record<JiraStatusCategory, StatusTagTone> = {
  new: 'neutral',
  indeterminate: 'accent',
  done: 'success',
};

const TAB_OPTIONS: ReadonlyArray<{ id: WorkItemsTab; label: string }> = [
  { id: 'assigned', label: 'Atribuídas' },
  { id: 'recent', label: 'Recentes' },
  { id: 'favorites', label: 'Favoritas' },
];

function getIssueStatusLabel(issue: JiraIssue): string {
  const status = (issue.statusName ?? '').trim();
  return status.length > 0 ? status : STATUS_WITHOUT_LABEL;
}

function issueMatchesQuery(issue: JiraIssue, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return issue.key.toLowerCase().includes(needle) || issue.summary.toLowerCase().includes(needle);
}

async function loadSidebarLists(): Promise<{ recent: JiraIssue[]; assigned: JiraIssue[] }> {
  const client = await JiraClient.fromStorage();
  const [recent, assigned] = await Promise.all([
    client.searchIssues(RECENT_ISSUES_JQL, 20),
    client.searchIssues(MY_OPEN_ISSUES_JQL, 20),
  ]);
  return { recent, assigned };
}

async function searchRemoteIssues(query: string): Promise<JiraIssue[]> {
  if (query.length < 2) {
    return [];
  }

  const client = await JiraClient.fromStorage();
  const normalizedKey = query.toUpperCase();
  if (ISSUE_KEY_PATTERN.test(normalizedKey)) {
    return [await client.getIssue(normalizedKey)];
  }

  return client.searchIssues(`text ~ ${quoteJql(query)} ORDER BY updated DESC`, 12);
}

async function hydrateFavoriteIssues(issueKeys: string[], knownIssues: JiraIssue[]): Promise<JiraIssue[]> {
  if (issueKeys.length === 0) {
    return [];
  }

  const knownByKey = new Map(knownIssues.map((issue) => [issue.key, issue]));
  const missingKeys = issueKeys.filter((key) => !knownByKey.has(key));

  if (missingKeys.length > 0) {
    const client = await JiraClient.fromStorage();
    const jql = `key in (${missingKeys.map((key) => quoteJql(key)).join(', ')})`;
    const fetched = await client.searchIssues(jql, missingKeys.length);
    for (const issue of fetched) {
      knownByKey.set(issue.key, issue);
    }
  }

  return issueKeys.map((key) => knownByKey.get(key)).filter((issue): issue is JiraIssue => Boolean(issue));
}

type WorkItemIssueCardProps = {
  issue: JiraIssue;
  isFavorite: boolean;
  onSelect: (issue: JiraIssue) => void;
  onDrag: (issue: JiraIssue, pointer: { x: number; y: number }) => void;
};

function WorkItemIssueCard({ issue, isFavorite, onSelect, onDrag }: WorkItemIssueCardProps) {
  const dragRef = useRef<{ originX: number; originY: number; hasMoved: boolean } | null>(null);
  const typeMark = resolveIssueTypeMark(issue.issueTypeName);
  const accent = projectColorFromKey(issue.key);

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (event.button !== 0) {
      return;
    }
    dragRef.current = { originX: event.clientX, originY: event.clientY, hasMoved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    const drag = dragRef.current;
    if (!drag || drag.hasMoved) {
      return;
    }
    if (Math.hypot(event.clientX - drag.originX, event.clientY - drag.originY) < DRAG_THRESHOLD_PX) {
      return;
    }
    drag.hasMoved = true;
    event.currentTarget.releasePointerCapture(event.pointerId);
    onDrag(issue, { x: event.clientX, y: event.clientY });
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.hasMoved) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onSelect(issue);
  };

  return (
    <div
      className={classNames(
        styles.workItemsSidebar__issueCard,
        styles[`workItemsSidebar__issueCard--${issue.statusCategory}`],
      )}
      style={{ ['--work-item-accent' as string]: accent }}
    >
      <button
        type="button"
        className={styles.workItemsSidebar__issueBody}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        title={`${issue.key} · ${issue.summary}. Arraste para o calendário (30 min) ou clique para editar.`}
      >
        <span className={styles.workItemsSidebar__issueMeta}>
          <span
            className={classNames(
              styles.workItemsSidebar__issueTypeMark,
              styles[`workItemsSidebar__issueTypeMark--${typeMark}`],
            )}
            aria-hidden
          >
            <IssueTypeIcon mark={typeMark} iconUrl={issue.issueTypeIconUrl} label={issue.issueTypeName} />
          </span>
          <span className={styles.workItemsSidebar__issueKey}>{issue.key}</span>
        </span>
        <span className={styles.workItemsSidebar__issueSummary}>{issue.summary}</span>
        <span className={styles.workItemsSidebar__issueStatus}>
          <StatusTag tone={STATUS_TONES[issue.statusCategory]}>
            {issue.statusName?.trim() || STATUS_WITHOUT_LABEL}
          </StatusTag>
        </span>
      </button>
      <ActionButton
        variant="ghost"
        isCompact
        icon={Star}
        label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        aria-pressed={isFavorite}
        className={classNames(
          styles.workItemsSidebar__favorite,
          isFavorite && styles['workItemsSidebar__favorite--active'],
        )}
        onClick={() => void toggleBookmark(issue.key, issue.summary)}
      />
    </div>
  );
}

export function WorkItemsSidebar({
  isCollapsible = false,
  variant = 'sidebar',
  onCollapse,
  onSelectIssue,
  onDragIssue,
}: WorkItemsSidebarProps) {
  const { value: bookmarks } = useStoredValue('bookmarks');
  const [activeTab, setActiveTab] = useState<WorkItemsTab>('assigned');
  const [query, setQuery] = useState('');
  const [hiddenStatuses, setHiddenStatuses] = useState<ReadonlySet<string>>(() => new Set());
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
  const statusFilterRef = useRef<HTMLDivElement>(null);
  const isInline = variant === 'inline';

  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length > 0;
  const debouncedQuery = useDebouncedValue(trimmedQuery, 300);

  const lists = useAsync(loadSidebarLists, []);
  const search = useAsync(
    () => searchRemoteIssues(debouncedQuery),
    [debouncedQuery],
    hasQuery && debouncedQuery.length >= 2 && debouncedQuery === trimmedQuery,
  );

  const favoriteKeys = useMemo(() => bookmarks.map((bookmark) => bookmark.issueKey), [bookmarks]);
  const favoriteKeySet = useMemo(() => new Set(favoriteKeys), [favoriteKeys]);
  const favoriteKeysSignature = favoriteKeys.join('|');

  const knownIssues = useMemo(() => {
    const byKey = new Map<string, JiraIssue>();
    for (const issue of [...(lists.data?.recent ?? []), ...(lists.data?.assigned ?? [])]) {
      byKey.set(issue.key, issue);
    }
    return [...byKey.values()];
  }, [lists.data]);

  const knownIssuesSignature = knownIssues.map((issue) => issue.key).join('|');

  const favorites = useAsync(
    () => hydrateFavoriteIssues(favoriteKeys, knownIssues),
    [favoriteKeysSignature, knownIssuesSignature],
    activeTab === 'favorites' && !hasQuery,
  );

  useEffect(() => {
    setHiddenStatuses(new Set());
    setIsStatusFilterOpen(false);
  }, [hasQuery]);

  useEffect(() => {
    if (!isStatusFilterOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (!statusFilterRef.current?.contains(target)) {
        setIsStatusFilterOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsStatusFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isStatusFilterOpen]);

  const issues = useMemo(() => {
    if (hasQuery) {
      if (!debouncedQuery || debouncedQuery !== trimmedQuery) {
        return [];
      }
      return (search.data ?? []).filter((issue) => issueMatchesQuery(issue, debouncedQuery));
    }

    switch (activeTab) {
      case 'recent':
        return lists.data?.recent ?? [];
      case 'assigned':
        return lists.data?.assigned ?? [];
      case 'favorites':
        return favorites.data ?? [];
      default: {
        const exhaustive: never = activeTab;
        return exhaustive;
      }
    }
  }, [activeTab, debouncedQuery, favorites.data, hasQuery, lists.data, search.data, trimmedQuery]);

  const availableStatuses = useMemo(() => {
    const statuses = new Set<string>();
    for (const issue of issues) {
      statuses.add(getIssueStatusLabel(issue));
    }
    return [...statuses].sort((left, right) => left.localeCompare(right, 'pt-BR'));
  }, [issues]);

  const filteredIssues = useMemo(() => {
    if (hiddenStatuses.size === 0) {
      return issues;
    }
    return issues.filter((issue) => !hiddenStatuses.has(getIssueStatusLabel(issue)));
  }, [hiddenStatuses, issues]);

  const isStatusFilterActive = hiddenStatuses.size > 0;
  const isLoading = hasQuery
    ? debouncedQuery !== trimmedQuery || search.isLoading
    : activeTab === 'favorites'
      ? favorites.isLoading && !favorites.data
      : lists.isLoading && !lists.data;

  const listError = hasQuery ? search.error : activeTab === 'favorites' ? favorites.error : lists.error;

  const emptyMessage = hasQuery
    ? 'Nenhuma issue encontrada.'
    : issues.length > 0 && isStatusFilterActive
      ? 'Nenhuma issue com os status selecionados.'
      : activeTab === 'favorites'
        ? 'Nenhuma issue favorita ainda.'
        : 'Nenhuma issue encontrada.';

  const handleToggleStatus = (status: string): void => {
    setHiddenStatuses((previous) => {
      const next = new Set(previous);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  return (
    <aside
      className={classNames(
        styles.workItemsSidebar,
        isInline && styles['workItemsSidebar--inline'],
      )}
      aria-label="Itens de trabalho"
    >
      <div className={styles.workItemsSidebar__header}>
        <div className={styles.workItemsSidebar__titleRow}>
          <h2 className={styles.workItemsSidebar__title}>Itens de trabalho</h2>
          {isCollapsible && onCollapse && (
            <ActionButton
              variant="ghost"
              isCompact
              icon={PanelLeftClose}
              label="Recolher painel"
              onClick={onCollapse}
            />
          )}
        </div>

        <TextInput
          className={styles.workItemsSidebar__search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar issues..."
          aria-label="Buscar issues"
        />

        <div className={styles.workItemsSidebar__tabsRow}>
          <div className={styles.workItemsSidebar__tabs} role="tablist" aria-label="Filtrar itens de trabalho">
            {TAB_OPTIONS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={classNames(
                  styles.workItemsSidebar__tab,
                  activeTab === tab.id && styles['workItemsSidebar__tab--active'],
                )}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div ref={statusFilterRef} className={styles.workItemsSidebar__statusFilter}>
            <ActionButton
              variant="ghost"
              isCompact
              icon={ListFilter}
              label="Filtrar por status"
              aria-expanded={isStatusFilterOpen}
              aria-haspopup="dialog"
              onClick={() => setIsStatusFilterOpen((open) => !open)}
            />
            {isStatusFilterActive && <span className={styles.workItemsSidebar__statusBadge} aria-hidden />}

            {isStatusFilterOpen && (
              <div className={styles.workItemsSidebar__statusPopover} role="dialog" aria-label="Filtrar por status">
                <div className={styles.workItemsSidebar__statusPopoverHeader}>
                  <p className={styles.workItemsSidebar__statusPopoverTitle}>Filtrar por status</p>
                  {isStatusFilterActive && (
                    <button
                      type="button"
                      className={styles.workItemsSidebar__showAllStatuses}
                      onClick={() => setHiddenStatuses(new Set())}
                    >
                      Mostrar todos
                    </button>
                  )}
                </div>

                {availableStatuses.length === 0 ? (
                  <p className={styles.workItemsSidebar__statusEmpty}>Nenhum status nesta lista.</p>
                ) : (
                  <ul className={styles.workItemsSidebar__statusList}>
                    {availableStatuses.map((status, statusIndex) => {
                      const isVisible = !hiddenStatuses.has(status);
                      const switchId = `work-items-status-${statusIndex}`;
                      return (
                        <li key={status} className={styles.workItemsSidebar__statusRow}>
                          <label htmlFor={switchId} className={styles.workItemsSidebar__statusName} title={status}>
                            {status}
                          </label>
                          <button
                            id={switchId}
                            type="button"
                            role="switch"
                            aria-checked={isVisible}
                            aria-label={`Mostrar status ${status}`}
                            className={classNames(
                              styles.workItemsSidebar__statusSwitch,
                              isVisible && styles['workItemsSidebar__statusSwitch--on'],
                            )}
                            onClick={() => handleToggleStatus(status)}
                          >
                            <span className={styles.workItemsSidebar__statusSwitchKnob} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.workItemsSidebar__list}>
        {isLoading && <LoadingSkeleton lines={isInline ? 2 : 4} />}
        {listError && !isLoading && <ErrorNotice message={listError} />}
        {!isLoading && !listError && filteredIssues.length === 0 && (
          <p className={styles.workItemsSidebar__empty}>{emptyMessage}</p>
        )}
        {!isLoading &&
          filteredIssues.map((issue) => (
            <WorkItemIssueCard
              key={issue.key}
              issue={issue}
              isFavorite={favoriteKeySet.has(issue.key)}
              onSelect={onSelectIssue}
              onDrag={onDragIssue}
            />
          ))}
      </div>
    </aside>
  );
}
