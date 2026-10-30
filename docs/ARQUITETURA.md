# Proposta de arquitetura — SaaS multi-tenant para arenas

Status: **proposta para validação** (nenhum código alterado ainda).

## 1. Diagnóstico do projeto atual

| Item | Situação | Consequência |
|---|---|---|
| Stack | Next.js 16 (App Router), React 19, TS, Tailwind 4, Radix, Supabase (JS), zod, react-hook-form, recharts, pdfmake | Mantida. |
| Autenticação | Cookie `admin_auth` com base64 de timestamp, `httpOnly: false`, **nunca validado no servidor**. Proteção só no cliente (`AdminProtected`). Uma senha única por área. | **Insegura e sem usuários.** Descartar por completo. |
| Acesso a dados | Tudo via `supabaseAdmin()` (service role) dentro de server actions e rotas. Service role ignora RLS. Server actions não checam sessão. | Sem isolamento possível. Precisa trocar para cliente com sessão do usuário + RLS. |
| Schema | Tabelas `participantes`, `chaveamentos`, `custos`, `link_inscricoes` sem `tenant_id`, colunas em PT com nomes mistos (`idade`, `age`, `wpp`). Sem migrations versionadas. | Redesenhar com migrations. |
| Reaproveitável | UI (Radix/shadcn), layouts admin, motor de chaveamento (`chaveamento.ts`), cronômetro, formulários de inscrição, exportação PDF, gráficos do financeiro, padrão de máscaras/telefone. | Mover para o módulo Campeonatos e generalizar. |
| Acoplado ao Jiu-Jitsu | Faixas (`beltEnum`), categorias de peso (`weight-categories.ts`), Gi/NoGi, Festival, regra de idade infantil, tabela de pesos. | Viram **configuração por tenant/evento** no banco. |

## 2. Decisões de arquitetura

1. **Supabase Auth** substitui o login por senha. Sessão em cookie httpOnly via `@supabase/ssr`.
2. **Tenant vem da sessão, nunca do cliente.** O tenant ativo é guardado em cookie assinado e **revalidado a cada request** contra `memberships`. Mesmo assim, a garantia real é o **RLS no banco**: qualquer query feita com a sessão do usuário só enxerga linhas dos tenants dos quais ele é membro.
3. **Dois clientes Supabase:**
   - `createServerClient` (sessão do usuário, sujeito a RLS) para 99% do código.
   - `service role` apenas em um módulo `server-only` restrito (Super Admin, webhooks futuros, jobs). Proibido em actions de tenant.
4. **Autorização em 3 camadas:** RLS (dados) → helper `requireMember(tenant, permission)` nas server actions → UI esconde o que o usuário não pode.
5. **RBAC por permissões, não por role fixa:** `roles` mapeiam para um conjunto de permissões (`students.write`, `payments.read`, ...). Novas roles = novas linhas, sem mudar código.
6. **Módulos como feature flags por tenant** (`tenant_modules`) + limites (`tenant_limits`). Checados no servidor e na navegação.
7. **Monólito Next.js**, rotas por tenant em `/t/[slug]/...` (o slug só serve para navegar; a autorização vem da membership). Super Admin em `/platform/...` com verificação separada (`platform_admins`).
8. **Sem abstrações extras:** funções SQL pequenas (`is_member`, `has_permission`, `module_enabled`), um helper de sessão no TS, e só.

## 3. Modelo de dados proposto

Convenções: `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at` (trigger), `deleted_at` onde há soft delete (S), `tenant_id uuid not null references tenants` com índice em todas as tabelas de tenant. FKs compostas `(tenant_id, id)` nas relações entre tabelas de tenant para impedir referência cruzada.

**Plataforma**
- `tenants` (name, slug unique, logo_path, status, settings jsonb: telefone, instagram, endereço, cores)
- `platform_admins` (user_id)
- `plans` (code, name) · `plan_modules` (plan, module) · `plan_limits` (plan, key, value)
- `tenant_subscriptions` (tenant_id, plan, status, current_period_end) — só estrutura, sem cobrança
- `tenant_modules` (tenant_id, module, enabled) — override por tenant

**Acesso**
- `profiles` (user_id = auth.users.id, name, phone)
- `memberships` (user_id, tenant_id, role_id, status) unique (user_id, tenant_id)
- `roles` (tenant_id null = papéis do sistema, code, name) · `role_permissions` (role_id, permission)
  - Papéis iniciais: `owner`, `admin`, `staff`, `teacher`, **`student`** (para o portal mobile)

**Gestão (S em alunos, professores, turmas)**
- `sports` (tenant_id, name, active)
- `students` (tenant_id, user_id null, name, phone, email, birth_date, document, status, notes)
- `teachers` (tenant_id, user_id null, name, phone, email, status)
- `classes` (tenant_id, sport_id, teacher_id, name, capacity, monthly_fee_cents, status, notes)
- `class_schedules` (class_id, weekday 0–6, start_time, end_time) — uma turma, vários horários
- `enrollments` (tenant_id, student_id, class_id, started_at, ended_at, status, fee_cents, notes, capacity_override bool)
  - Capacidade garantida **no banco** (trigger/função que conta matrículas ativas), com exceção só se `capacity_override` for definido por quem tem permissão.

**Financeiro**
- `invoices` (tenant_id, student_id, enrollment_id, competence date, amount_cents, due_date, paid_at, paid_amount_cents, status: `paid|pending|cancelled|exempt`)
  - **"Atrasado" é derivado** (`pending` com `due_date < hoje`), exposto em view; não é gravado, para nunca ficar desatualizado.
  - Unique (enrollment_id, competence) evita cobrança duplicada.
  - Dinheiro sempre em centavos (`integer`).

**Ranking**
- `rankings` (tenant_id, sport_id, name, season, active)
- `ranking_categories` (ranking_id, name)
- `ranking_entries` (ranking_id, category_id, student_id/participant)
- `ranking_point_events` (entry_id, points, reason, source_type, source_id, created_at) — **fonte da verdade**; total = soma (view/materializada). `source_*` permite ligar a campeonato depois.

**Campeonatos** (generalização do módulo atual)
- `championships` (tenant_id, sport_id, name, date, status, settings)
- `championship_categories` (configuráveis: faixa/idade/peso viram atributos por evento)
- `championship_registrations` (substitui `participantes`; pode referenciar `students` opcionalmente)
- `brackets` (substitui `chaveamentos`, JSON de lutas mantido por ora)
- `championship_ranking_rules` (placement → pontos, ranking_id opcional) — integração opcional e desacoplada: ao finalizar, uma função gera `ranking_point_events`.
- `expenses` (substitui `custos`, agora por tenant/campeonato)

**RLS (padrão único)**
```sql
-- leitura
using (tenant_id in (select tenant_id from memberships where user_id = auth.uid() and status='active'))
-- escrita
with check (has_permission(tenant_id, 'students.write'))
```
Tabelas de módulo adicionam `and module_enabled(tenant_id, 'championships')`.

## 4. Modelo mobile para alunos e professores

**Recomendação: PWA dentro do mesmo app Next.js**, não app nativo agora. Mesmo login, mesmo banco, mesmas regras de RLS; instalável na tela inicial; zero custo de loja. Se no futuro for preciso publicar nas lojas, o mesmo backend serve a um app Capacitor/Expo sem refazer nada. (Você pediu antes para não implementar app mobile agora: aqui é só o desenho e o que o banco precisa suportar desde a Fase 1.)

**Rotas**: `/t/[slug]/app/...` — layout mobile-first (barra inferior), separado do painel desktop. O login redireciona por role: `owner/admin/staff` → painel; `teacher` e `student` → portal.

**Aluno** (vê só o que é dele)
- Minhas turmas e horários · agenda da semana
- Meus dados e status da matrícula
- Minhas mensalidades (pago/pendente/atrasado, vencimento) — somente leitura
- Ranking e campeonatos abertos (se o módulo estiver ativo)
- Avisos da arena

**Professor**
- Minhas turmas e agenda do dia
- Lista de alunos da turma (nome, telefone, observações)
- Futuro: chamada/presença, lançar pontos de ranking

**O que isso exige do desenho (já na Fase 1/2):**
- `students.user_id` e `teachers.user_id` (vínculo com a conta) e role `student`.
- Convite: admin cadastra o aluno e envia convite por e-mail/link mágico; a conta é vinculada ao registro existente, sem duplicar.
- Políticas RLS por vínculo: aluno lê só `enrollments`/`invoices` do próprio `student_id`; professor lê só turmas com `teacher_id` dele e os alunos matriculadas nelas. Aluno **não** vê dados de outros alunos.
- Agenda (`class_schedules`) legível por todos os membros do tenant, sem dados pessoais.
- Presença (`attendances`) e avisos (`announcements`) ficam **fora do MVP**; o modelo comporta adicionar depois.

## 5. Plano por fase (com validação ao fim de cada uma)

1. **Foundation**: migrations, Supabase Auth, tenants/memberships/roles/permissões, RLS, helpers de sessão, Super Admin mínimo, remoção do login por cookie/senha. *Prova:* dois tenants, usuário de A não lê nem escreve em B (testes SQL + testes de rota).
2. **Gestão**: modalidades, alunos, professores, turmas, horários, matrículas com capacidade, agenda.
3. **Financeiro**: mensalidades, view de atraso, dashboard, inadimplência. Geração mensal por matrícula.
4. **Ranking**: rankings, temporadas, categorias, eventos de pontos.
5. **Campeonatos**: migrar para `tenant_id`, categorias configuráveis (remover faixas/pesos hardcoded), integração opcional com ranking.
6. **Personalização**: logo (Supabase Storage por tenant), cores, dados da organização.
7. **SaaS**: planos, limites e status, checados no servidor.
8. **Portal mobile (PWA)**: depois da Fase 3, quando matrículas e mensalidades existirem.

Em cada fase: `tsc`, `eslint`, `build`, teste de isolamento entre tenants e verificação de regressão.

## 6. Decisões pendentes (preciso de você)

1. **Projeto Supabase novo**: você cria e me passa a URL e as chaves? (Eu não crio projeto nem credenciais.) Usarei migrations em `supabase/migrations`, aplicadas via CLI.
2. **Rotas por slug** (`/t/arena-xyz/...`) ou **subdomínio** (`arena-xyz.seudominio.com`)? Recomendo slug no MVP.
3. **Idioma do banco**: nomes de tabelas/colunas em inglês (proposto) com UI em português.
4. **Portal mobile**: PWA no mesmo app (recomendado) ou app nativo depois?
5. **Cadastro de alunos pelo próprio aluno** (autoinscrição por link da arena) entra no MVP?
