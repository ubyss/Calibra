import { CONTENT_STYLES } from '@/content/content-styles';
import { type ContentScriptRequest, type ContentTimerState, sendToBackground } from '@/services/messaging';
import { formatClock } from '@/utils/duration';

const ISSUE_KEY_IN_PATH = /\/browse\/([A-Z][A-Z0-9_]+-\d+)/;
const ISSUE_KEY_IN_TITLE = /^\[([A-Z][A-Z0-9_]+-\d+)\]\s*(.+?)(?:\s+-\s+[^-]+)?$/;
const STATE_REFRESH_MS = 10_000;

interface PageIssue {
  key: string;
  summary: string;
}

let timerState: ContentTimerState | null = null;
let stateReceivedAt = Date.now();

const host = document.createElement('div');
const shadowRoot = host.attachShadow({ mode: 'closed' });
const style = document.createElement('style');
style.textContent = CONTENT_STYLES;
const pill = document.createElement('div');
pill.className = 'jiraTimerPill';
pill.setAttribute('role', 'region');
pill.setAttribute('aria-label', 'Timer do Timesheet');
shadowRoot.append(style, pill);

function readPageIssue(): PageIssue | null {
  const selectedIssue = new URLSearchParams(location.search).get('selectedIssue');
  const pathKey = ISSUE_KEY_IN_PATH.exec(location.pathname)?.[1];
  const titleMatch = ISSUE_KEY_IN_TITLE.exec(document.title);
  const key = selectedIssue ?? pathKey ?? titleMatch?.[1];

  if (!key || !/^[A-Z][A-Z0-9_]+-\d+$/.test(key)) {
    return null;
  }
  return { key, summary: titleMatch?.[1] === key ? titleMatch[2] : '' };
}

function createButton(label: string, request: ContentScriptRequest, isPrimary = false): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = isPrimary ? 'jiraTimerPill__action jiraTimerPill__action--primary' : 'jiraTimerPill__action';
  button.textContent = label;
  button.addEventListener('click', () => void dispatch(request));
  return button;
}

function createText(className: string, text: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  return span;
}

function currentElapsed(): number {
  if (!timerState) {
    return 0;
  }
  const drift = timerState.isRunning ? (Date.now() - stateReceivedAt) / 1000 : 0;
  return timerState.elapsedSeconds + drift;
}

function render(): void {
  const pageIssue = readPageIssue();
  const hasTimer = Boolean(timerState?.issueKey);

  if (!timerState?.isEnabled || (!pageIssue && !hasTimer)) {
    pill.classList.remove('jiraTimerPill--visible');
    return;
  }

  const children: Node[] = [createText('jiraTimerPill__dot', '')];

  if (hasTimer && timerState.issueKey) {
    children.push(
      createText('jiraTimerPill__clock', formatClock(currentElapsed())),
      createText('jiraTimerPill__issue', timerState.issueKey),
      timerState.isRunning
        ? createButton('Pausar', { type: 'timer:pause' })
        : createButton('Retomar', { type: 'timer:resume' }),
      createButton('Parar', { type: 'timer:stop' }, true),
    );
    if (pageIssue && pageIssue.key !== timerState.issueKey) {
      children.push(
        createButton(`Trocar para ${pageIssue.key}`, {
          type: 'timer:start',
          issueKey: pageIssue.key,
          issueSummary: pageIssue.summary,
        }),
      );
    }
  } else if (pageIssue) {
    children.push(
      createText('jiraTimerPill__issue', pageIssue.key),
      createButton(
        'Iniciar timer',
        { type: 'timer:start', issueKey: pageIssue.key, issueSummary: pageIssue.summary },
        true,
      ),
    );
  }

  pill.classList.toggle('jiraTimerPill--running', Boolean(timerState.isRunning));
  pill.replaceChildren(...children);
  requestAnimationFrame(() => pill.classList.add('jiraTimerPill--visible'));
}

function updateClockOnly(): void {
  const clock = pill.querySelector('.jiraTimerPill__clock');
  if (clock && timerState?.isRunning) {
    clock.textContent = formatClock(currentElapsed());
  }
}

async function dispatch(request: ContentScriptRequest): Promise<void> {
  try {
    const nextState = await sendToBackground<ContentTimerState | null>(request);
    if (nextState) {
      timerState = nextState;
      stateReceivedAt = Date.now();
    }
  } catch {
    timerState = null;
  }
  render();
}

let lastHref = location.href;

document.documentElement.append(host);
void dispatch({ type: 'timer:get' });

setInterval(updateClockOnly, 1000);
setInterval(() => void dispatch({ type: 'timer:get' }), STATE_REFRESH_MS);
setInterval(() => {
  if (location.href !== lastHref) {
    lastHref = location.href;
    render();
  }
}, 800);
window.addEventListener('focus', () => void dispatch({ type: 'timer:get' }));
