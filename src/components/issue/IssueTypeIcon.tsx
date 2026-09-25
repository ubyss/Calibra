import { Bookmark, Bug, CheckSquare, Layers, Sparkles, type LucideIcon } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';

import type { IssueTypeMark } from '@/utils/issue-type';

interface IssueTypeIconProps {
  mark: IssueTypeMark;
  iconUrl?: string;
  label?: string;
}

const FALLBACK_ICONS: Record<IssueTypeMark, { Icon: LucideIcon; color: string }> = {
  bug: { Icon: Bug, color: '#E34935' },
  story: { Icon: Bookmark, color: '#22A06B' },
  task: { Icon: CheckSquare, color: '#0C66E4' },
  epic: { Icon: Layers, color: '#9043E0' },
  default: { Icon: Sparkles, color: '#6b6b76' },
};

export function IssueTypeIcon({ mark, iconUrl, label }: IssueTypeIconProps): ReactNode {
  const [hasIconFailed, setHasIconFailed] = useState(false);

  useEffect(() => {
    setHasIconFailed(false);
  }, [iconUrl]);

  if (iconUrl && !hasIconFailed) {
    return (
      <img
        src={iconUrl}
        alt=""
        title={label}
        width={14}
        height={14}
        onError={() => setHasIconFailed(true)}
      />
    );
  }

  const fallback = FALLBACK_ICONS[mark];
  return <fallback.Icon size={14} color={fallback.color} aria-hidden strokeWidth={2} />;
}
