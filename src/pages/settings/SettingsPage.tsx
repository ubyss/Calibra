import { LogOut, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { PageHeader } from '@/components/layout/PageHeader';
import { ActionButton } from '@/components/ui/ActionButton';
import { FormField, SelectInput, TextInput } from '@/components/ui/FormField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SurfacePanel } from '@/components/ui/SurfacePanel';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { useToast } from '@/components/ui/ToastProvider';
import { WEEKDAY_LABELS } from '@/constants/defaults';
import { useStoredValue } from '@/hooks/useStoredValue';
import { disconnectAccount } from '@/services/account-service';
import { updateStorage } from '@/services/storage';
import type { AppSettings, JiraAuthMethod, ThemePreference } from '@/types/domain';
import { classNames, getInitials } from '@/utils/misc';

import { DataPrivacyPanel } from './DataPrivacyPanel';
import styles from './SettingsPage.module.css';

const AUTH_METHOD_LABELS: Record<JiraAuthMethod, string> = {
  apiToken: 'Token de API',
  personalToken: 'Token pessoal',
  browserSession: 'Sessão do navegador',
};

function saveSettings(changes: Partial<AppSettings>): void {
  void updateStorage('settings', (current) => ({ ...current, ...changes }));
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const { value: account } = useStoredValue('account');
  const { value: settings } = useStoredValue('settings');

  const toggleWorkingDay = (day: number): void => {
    const workingDays = settings.workingDays.includes(day)
      ? settings.workingDays.filter((item) => item !== day)
      : [...settings.workingDays, day].sort();
    saveSettings({ workingDays });
  };

  const handleDisconnect = async (): Promise<void> => {
    if (!window.confirm('Desconectar do Jira? Seus worklogs locais continuam salvos.')) {
      return;
    }
    await disconnectAccount();
    notify('Conta desconectada e token apagado.');
    navigate('/conectar');
  };

  return (
    <>
      <PageHeader title="Configurações" description="As preferências são salvas automaticamente, só neste navegador." />
      <div className={styles.settingsPage}>
        {account && (
          <SurfacePanel title="Conta do Jira">
            <div className={styles.settingsPage__account}>
              <span className={styles.settingsPage__accountAvatar} aria-hidden>
                {getInitials(account.user.displayName)}
              </span>
              <span className={styles.settingsPage__accountText}>
                <strong>{account.user.displayName}</strong>
                <span className={styles.settingsPage__accountMeta}>{account.baseUrl}</span>
                <span className={styles.settingsPage__accountMeta}>
                  {account.deployment === 'cloud' ? 'Jira Cloud' : 'Server / Data Center'} · {AUTH_METHOD_LABELS[account.authMethod]}
                </span>
              </span>
            </div>
            <div className={styles.settingsPage__actions}>
              <ActionButton icon={RefreshCw} onClick={() => navigate('/conectar')}>
                Reconectar
              </ActionButton>
              <ActionButton variant="danger" icon={LogOut} onClick={() => void handleDisconnect()}>
                Desconectar
              </ActionButton>
            </div>
          </SurfacePanel>
        )}

        <SurfacePanel title="Jornada de trabalho" subtitle="Usada nas metas, no calendário e nos relatórios.">
          <div className={styles.settingsPage__weekdays} role="group" aria-label="Dias úteis">
            {WEEKDAY_LABELS.map((label, day) => {
              const isActive = settings.workingDays.includes(day);
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={isActive}
                  className={classNames(styles.settingsPage__weekday, isActive && styles['settingsPage__weekday--active'])}
                  onClick={() => toggleWorkingDay(day)}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className={styles.settingsPage__fields}>
            <FormField label="Início do expediente">
              {(controlId) => (
                <TextInput id={controlId} type="time" value={settings.dayStart} onChange={(event) => saveSettings({ dayStart: event.target.value })} />
              )}
            </FormField>
            <FormField label="Fim do expediente">
              {(controlId) => (
                <TextInput id={controlId} type="time" value={settings.dayEnd} onChange={(event) => saveSettings({ dayEnd: event.target.value })} />
              )}
            </FormField>
            <FormField label="Meta diária (horas)">
              {(controlId) => (
                <TextInput
                  id={controlId}
                  type="number"
                  min={1}
                  max={24}
                  step={0.5}
                  value={settings.dailyTargetHours}
                  onChange={(event) => saveSettings({ dailyTargetHours: Math.max(1, Number(event.target.value) || 1) })}
                />
              )}
            </FormField>
            <FormField label="Arredondar timer">
              {(controlId) => (
                <SelectInput
                  id={controlId}
                  value={settings.roundToMinutes}
                  onChange={(event) => saveSettings({ roundToMinutes: Number(event.target.value) })}
                >
                  <option value={1}>Minuto exato</option>
                  <option value={5}>5 minutos</option>
                  <option value={15}>15 minutos</option>
                  <option value={30}>30 minutos</option>
                </SelectInput>
              )}
            </FormField>
          </div>
          <div className={styles.settingsPage__toggles}>
            <ToggleSwitch
              title="Ocultar sábado e domingo no calendário"
              description="Mostra só os dias da semana na grade semanal."
              isChecked={settings.hideWeekends}
              onChange={(hideWeekends) => saveSettings({ hideWeekends })}
            />
          </div>
        </SurfacePanel>

        <SurfacePanel title="Timer">
          <div className={styles.settingsPage__toggles}>
            <ToggleSwitch
              title="Pausar ao bloquear a tela"
              description="Retoma sozinho quando você volta."
              isChecked={settings.pauseOnLock}
              onChange={(pauseOnLock) => saveSettings({ pauseOnLock })}
            />
            <ToggleSwitch
              title="Pausar quando ocioso"
              description={`Sem uso do teclado e mouse por ${settings.idleMinutes} minutos.`}
              isChecked={settings.pauseOnIdle}
              onChange={(pauseOnIdle) => saveSettings({ pauseOnIdle })}
            />
            <ToggleSwitch
              title="Mostrar timer nas páginas do Jira"
              description="Um botão discreto para iniciar o timer direto na issue."
              isChecked={settings.showTimerOnJira}
              onChange={(showTimerOnJira) => saveSettings({ showTimerOnJira })}
            />
          </div>
          {settings.pauseOnIdle && (
            <FormField label="Minutos até considerar ocioso">
              {(controlId) => (
                <TextInput
                  id={controlId}
                  type="number"
                  min={1}
                  max={120}
                  value={settings.idleMinutes}
                  onChange={(event) => saveSettings({ idleMinutes: Math.max(1, Number(event.target.value) || 1) })}
                />
              )}
            </FormField>
          )}
        </SurfacePanel>

        <SurfacePanel title="Aparência">
          <SegmentedControl<ThemePreference>
            ariaLabel="Tema"
            value={settings.theme}
            onChange={(theme) => saveSettings({ theme })}
            options={[
              { value: 'system', label: 'Automático' },
              { value: 'light', label: 'Claro' },
              { value: 'dark', label: 'Escuro' },
            ]}
          />
        </SurfacePanel>

        <DataPrivacyPanel />
      </div>
    </>
  );
}
