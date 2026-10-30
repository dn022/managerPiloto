# Event Manager

Aplicação Next.js (App Router) para gestão de eventos esportivos: inscrições, chaveamento, cronômetro e painel financeiro.

## Desenvolvimento

```bash
npm install
npm run dev
```

## Variáveis de ambiente

Crie um `.env.local` com as variáveis abaixo (veja `.env.example`). Nunca versione valores reais.

## Pendências de configuração

- Banco de dados (Supabase ou outro) ainda não configurado.
- Regras de valor de inscrição e fluxo pós-inscrição ainda não definidos.
- Pagamentos não implementados.

## Fase 1 (Foundation) — multi-tenant

- Passo a passo completo, com todo o SQL para o SQL Editor, em [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md).
- Migrations em `supabase/migrations`. Aplicar no projeto Supabase **novo** (`supabase db push` ou SQL Editor).
- Teste de isolamento entre tenants (Postgres embutido, não precisa de banco nem de credenciais): `npm run test:db`.
- Primeiro Super Admin: crie um usuário em Authentication e rode no SQL Editor `insert into platform_admins (user_id) values ('<uuid>');`.
- Rotas: `/entrar` (login), `/minhas-arenas`, `/t/[slug]` (arena), `/platform` (Super Admin).
- Toda nova tabela de tenant deve: ter `tenant_id`, habilitar RLS, e conceder privilégios explícitos (o Supabase concede `all` por padrão a `authenticated`).

## Fase 5 (Campeonatos)

- Módulo de campeonatos reescrito sobre o modelo multi-tenant (`/t/[slug]/campeonatos`): categorias configuráveis, inscrições, chaves de eliminação, resultados, despesas e envio opcional de pontos ao ranking.
- O código do sistema antigo (login por senha, tabelas `participantes`/`chaveamentos`/`custos`, inscrição pública por CPF, chave pública, pontuação por equipes) foi removido. Fica disponível no histórico do Git.
- Testes: `npm test` (motor de chaves + isolamento e regras do banco).
- Ainda **não** existem: inscrição pública de atletas, página pública de chaves e exportação em PDF.

## Fase 6 (Personalização)

- `/t/[slug]/configuracoes` (permissão `tenant.manage`): nome, contatos, cor principal e logo. O logo vai para o bucket `tenant-assets` (público para leitura, 1 MB, PNG/JPG/WebP), numa pasta com o id do tenant; as policies de escrita exigem `tenant.manage` nessa pasta.
- `tenants.settings` só aceita chaves conhecidas (`phone`, `whatsapp`, `instagram`, `website`, `address`, `primary_color`), validadas no banco.
- `/t/[slug]/usuarios`: lista, adiciona (por e-mail de conta já existente) e desativa/reativa usuários. Só o owner gerencia usuários; o banco impede ficar sem owner ativo.
- A migration cria o bucket via `storage.buckets`; aplique no projeto Supabase novo junto com as demais.

## Fase 7 (Planos e assinatura)

- Assinatura por tenant: plano, status (`trial`, `active`, `past_due`, `cancelled`) e validade. `past_due` mantém acesso (carência); `cancelled` e trial vencido desligam os módulos (leitura e escrita nas tabelas de módulo passam a ser negadas pelo RLS via `module_enabled`).
- O Super Admin altera plano, status, validade e overrides de módulo em `/platform` (RPCs `set_tenant_subscription` e `set_tenant_module`, validadas no banco). Não há cobrança: uma integração futura de pagamento só precisa chamar `set_tenant_subscription`.
- `/t/[slug]/plano`: plano, situação, módulos incluídos e uso x limite (`plan_usage`). Aviso no topo quando a assinatura está em atraso, vencida ou cancelada.
- Limites hoje: alunos e turmas (`plan_limits`); chave ausente = ilimitado.

## Modo demo (sem Supabase)

```bash
npm run dev:demo
```

Abre em `http://localhost:3000` com um Postgres embutido (PGlite) que roda as migrations reais, com RLS ativo e dados de exemplo (duas arenas, alunos, turmas, mensalidades, ranking e um campeonato). Em `/entrar` aparecem as contas de teste; qualquer senha funciona.

- Nada sai da máquina e nada é persistido: reiniciar o servidor recria os dados.
- O cliente Supabase é substituído por um tradutor próprio (`app/_lib/demo`), ativado só com `DEMO_MODE=1`. Ele não substitui o teste contra um Supabase real (PostgREST, Auth e Storage de verdade).
