import { useCallback, useState } from 'react';

import { useToast } from '@/components/ui/ToastProvider';
import { uploadWorklogs } from '@/services/worklog-service';
import { getErrorMessage } from '@/utils/misc';

interface WorklogUpload {
  upload: (ids: string[]) => Promise<void>;
  isUploading: boolean;
}

export function useWorklogUpload(): WorklogUpload {
  const { notify } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  const upload = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) {
        return;
      }
      setIsUploading(true);
      try {
        const { uploaded, failures } = await uploadWorklogs(ids);
        if (uploaded > 0) {
          notify(uploaded === 1 ? '1 worklog enviado ao Jira.' : `${uploaded} worklogs enviados ao Jira.`);
        }
        if (failures.length > 0) {
          notify(`${failures.length} falharam: ${failures[0].worklog.issueKey} — ${failures[0].message}`, 'error');
        }
      } catch (error) {
        notify(getErrorMessage(error), 'error');
      } finally {
        setIsUploading(false);
      }
    },
    [notify],
  );

  return { upload, isUploading };
}
