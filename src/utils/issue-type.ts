export type IssueTypeMark = 'bug' | 'story' | 'task' | 'epic' | 'default';

export function resolveIssueTypeMark(issueTypeName: string | undefined): IssueTypeMark {
  const normalized = (issueTypeName ?? '').trim().toLowerCase();
  if (normalized.includes('bug') || normalized.includes('defeito')) {
    return 'bug';
  }
  if (normalized.includes('story') || normalized.includes('história') || normalized.includes('historia')) {
    return 'story';
  }
  if (normalized.includes('epic') || normalized.includes('épico') || normalized.includes('epico')) {
    return 'epic';
  }
  if (
    normalized.includes('task') ||
    normalized.includes('tarefa') ||
    normalized.includes('sub') ||
    normalized.includes('feature') ||
    normalized.includes('improvement') ||
    normalized.includes('melhoria')
  ) {
    return 'task';
  }
  return 'default';
}
