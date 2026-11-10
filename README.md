# CrossEdit 0.3.0

Editor desktop de PDF para Windows, com processamento local.

## Desenvolvimento

```bash
pnpm install
pnpm dev
```

## Gerar instalador Windows

```bash
pnpm dist:win
```

O instalador NSIS será criado em `release/`. O ícone do executável e do instalador está em `build/crossedit.ico`; o logótipo vetorial da interface está em `public/assets/crossedit-logo.svg`.

## Atualizações automáticas

O projeto já inclui a integração `electron-updater`, os eventos IPC e os controlos na interface. Para ativar a distribuição real de atualizações, é necessário configurar o repositório GitHub correto na secção `build.publish` do `package.json` (provider `github`, owner e repo) e publicar releases com os ficheiros gerados pelo electron-builder, incluindo `latest.yml`. Não publicar uma versão de produção antes de confirmar o proprietário e o nome exato do repositório. Sem `app-update.yml`, o CrossEdit continua a funcionar normalmente e informa que o canal de atualizações ainda não está configurado.

## Arquitetura modular

Novas ferramentas devem ser organizadas em `src/modules/`, seguindo as orientações de `src/modules/README.md`. A aplicação continua a ser Electron desktop; não é uma PWA.
