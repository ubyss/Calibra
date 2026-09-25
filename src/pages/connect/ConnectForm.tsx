import { ArrowRight } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ActionButton } from '@/components/ui/ActionButton';
import { ErrorNotice } from '@/components/ui/FeedbackStates';
import { FormField, TextInput } from '@/components/ui/FormField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SurfacePanel } from '@/components/ui/SurfacePanel';
import { useToast } from '@/components/ui/ToastProvider';
import { connectAccount, requestJiraPermission } from '@/services/account-service';
import type { JiraAuthMethod, JiraDeployment } from '@/types/domain';
import { getErrorMessage } from '@/utils/misc';

import styles from './ConnectPage.module.css';

const API_TOKEN_HELP_URL = 'https://id.atlassian.com/manage-profile/security/api-tokens';

const AUTH_OPTIONS: Record<JiraDeployment, { value: JiraAuthMethod; label: string }[]> = {
  cloud: [
    { value: 'apiToken', label: 'Token de API' },
    { value: 'browserSession', label: 'Sessão do navegador' },
  ],
  server: [
    { value: 'personalToken', label: 'Token pessoal' },
    { value: 'browserSession', label: 'Sessão do navegador' },
  ],
};

function parseUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

export function ConnectForm() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [deployment, setDeployment] = useState<JiraDeployment>('cloud');
  const [authMethod, setAuthMethod] = useState<JiraAuthMethod>('apiToken');
  const [baseUrl, setBaseUrl] = useState('');
  const [email, setEmail] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const parsedUrl = parseUrl(baseUrl);
  const isInsecure = parsedUrl?.protocol === 'http:';
  const needsSecret = authMethod !== 'browserSession';

  const handleDeploymentChange = (value: JiraDeployment): void => {
    setDeployment(value);
    setAuthMethod(AUTH_OPTIONS[value][0].value);
  };

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    if (!parsedUrl) {
      setError('Informe a URL completa, por exemplo https://suaempresa.atlassian.net');
      return;
    }
    if (needsSecret && !secret.trim()) {
      setError('Informe o token de acesso.');
      return;
    }

    setError(null);
    setIsConnecting(true);
    requestJiraPermission(parsedUrl.href)
      .then(async (isGranted) => {
        if (!isGranted) {
          throw new Error('Sem a permissão de acesso ao endereço do Jira a extensão não consegue buscar seus dados.');
        }
        const account = await connectAccount({
          baseUrl: parsedUrl.href,
          deployment,
          authMethod,
          email: email.trim(),
          secret: needsSecret ? secret.trim() : undefined,
        });
        notify(`Tudo certo, ${account.user.displayName.split(' ')[0]}!`);
        navigate('/');
      })
      .catch((reason: unknown) => setError(getErrorMessage(reason)))
      .finally(() => setIsConnecting(false));
  };

  return (
    <SurfacePanel title="Conectar ao Jira" subtitle="Leva menos de um minuto.">
      <form className={styles.connectPage__form} onSubmit={handleSubmit} noValidate>
        <SegmentedControl
          ariaLabel="Tipo de Jira"
          value={deployment}
          onChange={handleDeploymentChange}
          options={[
            { value: 'cloud', label: 'Jira Cloud' },
            { value: 'server', label: 'Server / Data Center' },
          ]}
        />

        <FormField label="Endereço do Jira">
          {(controlId) => (
            <TextInput
              id={controlId}
              type="url"
              inputMode="url"
              autoComplete="url"
              placeholder={deployment === 'cloud' ? 'https://suaempresa.atlassian.net' : 'https://jira.suaempresa.com'}
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
            />
          )}
        </FormField>

        {isInsecure && (
          <p className={styles.connectPage__warning}>
            Este endereço não usa HTTPS: o token trafegaria sem criptografia. Prefira a versão https.
          </p>
        )}

        <SegmentedControl
          ariaLabel="Forma de autenticação"
          value={authMethod}
          onChange={setAuthMethod}
          options={AUTH_OPTIONS[deployment]}
        />

        {authMethod === 'apiToken' && (
          <FormField label="E-mail da conta Atlassian">
            {(controlId) => (
              <TextInput
                id={controlId}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            )}
          </FormField>
        )}

        {needsSecret && (
          <FormField
            label={authMethod === 'apiToken' ? 'Token de API' : 'Token de acesso pessoal'}
            hint="Guardado criptografado neste navegador. Nunca é enviado a outro lugar além do seu Jira."
          >
            {(controlId, describedBy) => (
              <TextInput
                id={controlId}
                type="password"
                autoComplete="off"
                aria-describedby={describedBy}
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
              />
            )}
          </FormField>
        )}

        {authMethod === 'apiToken' && (
          <a className={styles.connectPage__helpLink} href={API_TOKEN_HELP_URL} target="_blank" rel="noreferrer noopener">
            Como criar um token de API na Atlassian
          </a>
        )}

        {authMethod === 'browserSession' && (
          <p className={styles.connectPage__promiseText}>
            Usa o login que você já tem aberto no navegador. Nenhuma senha é guardada.
          </p>
        )}

        {error && <ErrorNotice message={error} />}

        <ActionButton type="submit" variant="primary" icon={ArrowRight} isLoading={isConnecting}>
          Conectar
        </ActionButton>
      </form>
    </SurfacePanel>
  );
}
