export const CONTENT_STYLES = `
:host { all: initial; }
.jiraTimerPill {
  position: fixed;
  right: 1.25rem;
  bottom: 1.25rem;
  z-index: 2147483000;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.375rem 0.375rem 0.875rem;
  border-radius: 999px;
  background: rgba(24, 24, 32, 0.92);
  color: #f5f5f7;
  font: 500 0.8125rem/1.2 system-ui, -apple-system, "Segoe UI", sans-serif;
  box-shadow: 0 0.75rem 2rem rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(12px);
  opacity: 0;
  transform: translateY(0.75rem) scale(0.96);
  transition: opacity 240ms ease, transform 320ms cubic-bezier(0.2, 0.9, 0.3, 1.2);
}
.jiraTimerPill--visible { opacity: 1; transform: none; }
.jiraTimerPill__dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: #8b8d98;
}
.jiraTimerPill--running .jiraTimerPill__dot {
  background: #3dd68c;
  animation: jiraTimerPulse 1.6s ease-in-out infinite;
}
.jiraTimerPill__clock { font-variant-numeric: tabular-nums; letter-spacing: 0.02em; }
.jiraTimerPill__issue { color: #b4b4c0; }
.jiraTimerPill__action {
  min-width: 2.75rem;
  min-height: 2.75rem;
  padding: 0 0.875rem;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  color: inherit;
  font: inherit;
  cursor: pointer;
  transition: background 160ms ease, transform 160ms ease;
}
.jiraTimerPill__action:hover { background: rgba(255, 255, 255, 0.18); }
.jiraTimerPill__action:active { transform: scale(0.95); }
.jiraTimerPill__action:focus-visible { outline: 2px solid #9b9bf5; outline-offset: 2px; }
.jiraTimerPill__action--primary { background: #5b5bd6; }
.jiraTimerPill__action--primary:hover { background: #6e6ade; }
@keyframes jiraTimerPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(61, 214, 140, 0.5); }
  50% { box-shadow: 0 0 0 0.3rem rgba(61, 214, 140, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .jiraTimerPill, .jiraTimerPill__action { transition: none; }
  .jiraTimerPill--running .jiraTimerPill__dot { animation: none; }
}
`;
