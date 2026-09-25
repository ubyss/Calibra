import { getOriginPattern } from '@/services/jira-client';
import { type ContentTimerState, isContentScriptRequest, type ContentScriptRequest } from '@/services/messaging';
import { readStorage, subscribeStorage } from '@/services/storage';
import { getElapsedSeconds, pauseTimer, resumeTimer, startTimer, stopTimer } from '@/services/timer-service';
import { formatBadge } from '@/utils/duration';

const BADGE_ALARM = 'timer-badge';
const CONTENT_SCRIPT_ID = 'jira-issue-timer';
const BADGE_RUNNING_COLOR = '#5b5bd6';
const BADGE_PAUSED_COLOR = '#8b8d98';

async function refreshBadge(): Promise<void> {
  const timer = await readStorage('timer');
  if (!timer) {
    await chrome.action.setBadgeText({ text: '' });
    await chrome.alarms.clear(BADGE_ALARM);
    return;
  }

  await chrome.action.setBadgeText({ text: formatBadge(getElapsedSeconds(timer)) });
  await chrome.action.setBadgeBackgroundColor({ color: timer.resumedAt ? BADGE_RUNNING_COLOR : BADGE_PAUSED_COLOR });
  await chrome.alarms.create(BADGE_ALARM, { periodInMinutes: 1 });
}

async function refreshIdleDetection(): Promise<void> {
  const settings = await readStorage('settings');
  chrome.idle.setDetectionInterval(Math.max(1, settings.idleMinutes) * 60);
}

async function syncContentScript(): Promise<void> {
  const [account, settings] = await Promise.all([readStorage('account'), readStorage('settings')]);
  const registered = await chrome.scripting.getRegisteredContentScripts({ ids: [CONTENT_SCRIPT_ID] });
  if (registered.length) {
    await chrome.scripting.unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] });
  }

  if (!account || !settings.showTimerOnJira) {
    return;
  }

  const originPattern = getOriginPattern(account.baseUrl);
  const hasPermission = await chrome.permissions.contains({ origins: [originPattern] });
  if (!hasPermission) {
    return;
  }

  await chrome.scripting.registerContentScripts([
    { id: CONTENT_SCRIPT_ID, matches: [originPattern], js: ['content.js'], runAt: 'document_idle' },
  ]);
}

async function openApp(path = '/'): Promise<void> {
  const appUrl = chrome.runtime.getURL('index.html');
  const targetUrl = `${appUrl}#${path}`;
  const tabContexts = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.TAB] });
  const existingContext = tabContexts.find((context) => context.documentUrl?.startsWith(appUrl));

  if (existingContext && existingContext.tabId >= 0) {
    await chrome.tabs.update(existingContext.tabId, { active: true, url: targetUrl });
    await chrome.windows.update(existingContext.windowId, { focused: true });
    return;
  }
  await chrome.tabs.create({ url: targetUrl });
}

async function getContentTimerState(): Promise<ContentTimerState> {
  const [timer, settings] = await Promise.all([readStorage('timer'), readStorage('settings')]);
  return {
    isEnabled: settings.showTimerOnJira,
    issueKey: timer?.issueKey ?? null,
    isRunning: Boolean(timer?.resumedAt),
    elapsedSeconds: timer ? getElapsedSeconds(timer) : 0,
  };
}

async function handleContentRequest(request: ContentScriptRequest): Promise<ContentTimerState | null> {
  switch (request.type) {
    case 'timer:get':
      break;
    case 'timer:start':
      await startTimer(request.issueKey, request.issueSummary);
      break;
    case 'timer:pause':
      await pauseTimer();
      break;
    case 'timer:resume':
      await resumeTimer();
      break;
    case 'timer:stop':
      await stopTimer();
      break;
    case 'app:open':
      await openApp(request.path);
      return null;
    default: {
      const unhandled: never = request;
      throw new Error(`Mensagem não suportada: ${JSON.stringify(unhandled)}`);
    }
  }
  return getContentTimerState();
}

async function isTrustedSender(sender: chrome.runtime.MessageSender): Promise<boolean> {
  if (sender.id !== chrome.runtime.id || !sender.url) {
    return false;
  }
  if (sender.url.startsWith(chrome.runtime.getURL(''))) {
    return true;
  }

  const account = await readStorage('account');
  return Boolean(account) && new URL(sender.url).origin === new URL(account!.baseUrl).origin;
}

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (!isContentScriptRequest(message)) {
    return false;
  }

  void isTrustedSender(sender).then(async (isTrusted) => {
    if (!isTrusted) {
      sendResponse(null);
      return;
    }
    try {
      sendResponse(await handleContentRequest(message));
    } catch {
      sendResponse(null);
    }
  });
  return true;
});

chrome.idle.onStateChanged.addListener((state) => {
  void readStorage('settings').then((settings) => {
    if (state === 'idle' && settings.pauseOnIdle) {
      return pauseTimer(true);
    }
    if (state === 'locked' && (settings.pauseOnLock || settings.pauseOnIdle)) {
      return pauseTimer(true);
    }
    if (state === 'active') {
      return resumeTimer(true);
    }
    return undefined;
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === BADGE_ALARM) {
    void refreshBadge();
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-app') {
    void openApp();
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    void openApp('/conectar');
  }
});

chrome.permissions.onAdded.addListener(() => void syncContentScript());
chrome.permissions.onRemoved.addListener(() => void syncContentScript());

subscribeStorage('timer', () => void refreshBadge());
subscribeStorage('account', () => void syncContentScript());
subscribeStorage('settings', () => {
  void syncContentScript();
  void refreshIdleDetection();
});

void refreshBadge();
void refreshIdleDetection();
void syncContentScript();
