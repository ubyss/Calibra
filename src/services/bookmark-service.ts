import { updateStorage } from '@/services/storage';

export async function toggleBookmark(issueKey: string, summary: string): Promise<boolean> {
  let isBookmarked = false;
  await updateStorage('bookmarks', (bookmarks) => {
    if (bookmarks.some((bookmark) => bookmark.issueKey === issueKey)) {
      return bookmarks.filter((bookmark) => bookmark.issueKey !== issueKey);
    }
    isBookmarked = true;
    return [{ issueKey, summary, addedAt: new Date().toISOString() }, ...bookmarks];
  });
  return isBookmarked;
}

export async function removeBookmark(issueKey: string): Promise<void> {
  await updateStorage('bookmarks', (bookmarks) => bookmarks.filter((bookmark) => bookmark.issueKey !== issueKey));
}
