# Calibra

Extensão de navegador para **apontamento de horas no Jira**: cronômetro, calendário, worklogs e relatórios — com dados salvos **somente no seu navegador**.

Repositório: [github.com/ubyss/Calibra](https://github.com/ubyss/Calibra)

## O que é

A Calibra ajuda a **calibrar a jornada de trabalho** em cima do Jira Cloud ou Server/Data Center. Você conecta a conta uma vez, registra horas no calendário ou pelo timer e envia worklogs direto para as issues — sem servidor intermediário.

## Funcionalidades

- **Painel** — visão do dia e da semana
- **Calendário** — blocos de tempo arrastáveis, cópia de worklogs e timesheet por período
- **Timer** — cronômetro com pausa por ociosidade ou bloqueio de tela (configurável)
- **Worklogs** — listagem, edição e envio ao Jira
- **Importar** — carga de worklogs via CSV
- **Relatórios** — horas da equipe, sprint e estimado × real
- **Favoritos e grupos** — atalhos para issues e organização de pessoas
- **Privacidade** — token/credencial guardados criptografados no navegador; conversa só com o seu Jira

## Requisitos

- [Node.js](https://nodejs.org/) 18+ (recomendado LTS)
- npm (vem com o Node)
- Google Chrome 116+ (ou Chromium / Edge compatível com Manifest V3)
- Conta no Jira (Cloud com API token, ou Server/Data Center)

## Instalação (do código)

### 1. Clonar o repositório

```bash
git clone https://github.com/ubyss/Calibra.git
cd Calibra
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Gerar a extensão

```bash
npm run build
```

Isso cria a pasta `dist/` com o pacote pronto para o Chrome (ícones, popup, app e content script).

### 4. Carregar no Chrome

1. Abra `chrome://extensions`
2. Ative **Modo do desenvolvedor** (canto superior direito)
3. Clique em **Carregar sem compactação**
4. Selecione a pasta `dist` do projeto

A extensão deve aparecer na barra com o ícone da Calibra.

### 5. Conectar ao Jira

1. Clique no ícone da extensão (ou abra a página de opções)
2. Informe o **endereço do Jira** (ex.: `https://sua-empresa.atlassian.net`)
3. Escolha Cloud ou Server/Data Center
4. Cole o **API token** (Cloud) ou as credenciais do servidor
5. Autorize o acesso ao host quando o Chrome pedir

Atalho padrão para abrir o app: `Alt+J` (Windows/Linux) ou `Command+Shift+J` (macOS).

## Desenvolvimento

Rebuild automático ao editar arquivos:

```bash
npm run dev
```

Depois de cada build, em `chrome://extensions` use **Atualizar** na card da extensão para recarregar a `dist/`.

Scripts úteis:

| Comando | O que faz |
|--------|-----------|
| `npm run build` | Typecheck + build completo da extensão |
| `npm run dev` | Build em modo watch (desenvolvimento) |
| `npm run icons` | Regenera os PNGs em `public/icons/` |

## Estrutura rápida

```
src/
  app/           # App principal (página de opções)
  background/    # Service worker
  content/       # Integração nas páginas do Jira
  components/    # UI reutilizável
  pages/         # Painel, calendário, relatórios, etc.
  popup/         # Popup da toolbar
  services/      # Jira, storage, timer, crypto
public/
  manifest.json  # Manifest V3
  icons/         # Ícones da extensão
```

## Privacidade

- Dados e preferências ficam no **storage local** do navegador
- Credenciais são **criptografadas** antes de salvar
- Não há backend próprio: as chamadas vão **direto ao seu Jira**
- Você pode revogar o token a qualquer momento nas configurações da conta Atlassian/Jira

## Stack

React 19 · TypeScript · Vite · Manifest V3 · date-fns · Motion · Lucide

## Licença

Uso interno / projeto pessoal — ajuste conforme a política do seu time se for publicar ou redistribuir.
