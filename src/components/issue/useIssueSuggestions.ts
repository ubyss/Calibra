import { useMemo } from 'react';

import { ISSUE_KEY_PATTERN } from '@/constants/defaults';
import { useAsync } from '@/hooks/useAsync';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useStoredValue } from '@/hooks/useStoredValue';
import { JiraClient } from '@/services/jira-client';
import { quoteJql } from '@/services/jira-mappers';

export interface IssueSelection {
  key: string;
  summary: string;
  issueTypeName?: string;
  issueTypeIconUrl?: string;
}

const RECENT_LIMIT = 6;

interface IssueSuggestions {
  suggestions: IssueSelection[];
  isSearching: boolean;
  error: string | null;
}

async function searchRemoteIssues(query: string): Promise<IssueSelection[]> {
  if (query.length < 2) {
    return [];
  }

  const client = await JiraClient.fromStorage();
  const normalizedKey = query.toUpperCase();
  if (ISSUE_KEY_PATTERN.test(normalizedKey)) {
    const issue = await client.getIssue(normalizedKey);
    return [{ key: issue.key, summary: issue.summary, issueTypeName: issue.issueTypeName, issueTypeIconUrl: issue.issueTypeIconUrl }];
  }

  const issues = await client.searchIssues(`text ~ ${quoteJql(query)} ORDER BY updated DESC`, 8);
  return issues.map((issue) => ({
    key: issue.key,
    summary: issue.summary,
    issueTypeName: issue.issueTypeName,
    issueTypeIconUrl: issue.issueTypeIconUrl,
  }));
}

export function useIssueSuggestions(query: string): IssueSuggestions {
  const debouncedQuery = useDebouncedValue(query.trim(), 350);
  const { value: bookmarks } = useStoredValue('bookmarks');
  const { value: worklogs } = useStoredValue('worklogs');

  const localSuggestions = useMemo(() => {
    const byKey = new Map<string, IssueSelection>();
    bookmarks.forEach((bookmark) => byKey.set(bookmark.issueKey, { key: bookmark.issueKey, summary: bookmark.summary }));
    [...worklogs]
      .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))
      .forEach((worklog) => {
        if (!byKey.has(worklog.issueKey)) {
          byKey.set(worklog.issueKey, {
            key: worklog.issueKey,
            summary: worklog.issueSummary ?? '',
            issueTypeName: worklog.issueTypeName,
            issueTypeIconUrl: worklog.issueTypeIconUrl,
          });
        }
      });
    return [...byKey.values()];
  }, [bookmarks, worklogs]);

  const remote = useAsync(() => searchRemoteIssues(debouncedQuery), [debouncedQuery], debouncedQuery.length >= 2);

  const suggestions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const localMatches = localSuggestions
      .filter((issue) => !needle || `${issue.key} ${issue.summary}`.toLowerCase().includes(needle))
      .slice(0, RECENT_LIMIT);
    const remoteMatches = needle.length >= 2 ? remote.data ?? [] : [];
    const merged = new Map<string, IssueSelection>();
    [...localMatches, ...remoteMatches].forEach((issue) => merged.set(issue.key, issue));
    return [...merged.values()];
  }, [localSuggestions, query, remote.data]);

  return {
    suggestions,
    isSearching: remote.isLoading || debouncedQuery !== query.trim(),
    error: remote.error,
  };
}
