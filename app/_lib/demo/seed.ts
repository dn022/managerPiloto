import "server-only";

type Db = import("@electric-sql/pglite").PGlite;

// Contas do modo demo (qualquer senha não vazia funciona).
export const DEMO_ACCOUNTS = [
  { email: "super@demo.test", name: "Super Admin", note: "Plataforma (/platform)" },
  { email: "dono@demo.test", name: "Marina Prado", note: "Dona da Arena Demo (tudo)" },
  { email: "gestor@demo.test", name: "Rafael Gestor", note: "Administrador da Arena Demo" },
  { email: "recepcao@demo.test", name: "Camila Recepção", note: "Funcionária da Arena Demo" },
  { email: "prof@demo.test", name: "Carlos Professor", note: "Professor da Arena Demo" },
  { email: "aluno@demo.test", name: "João Aluno", note: "Aluno da Arena Demo" },
  { email: "beta@demo.test", name: "Paula Beta", note: "Dona da Escola Beta (plano só gestão)" },
];

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export async function seedDemo(db: Db) {
  const ids = new Map<string, string>();
  DEMO_ACCOUNTS.forEach((a, i) => ids.set(a.email, uid(i + 1)));
  const asUser = (email: string) => db.query("select set_config('request.jwt.claim.sub', $1, false)", [ids.get(email)]);
  const one = async (sql: string, params: unknown[] = []) => (await db.query<{ id: string }>(sql, params)).rows[0].id;

  for (const a of DEMO_ACCOUNTS) {
    await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
      ids.get(a.email),
      a.email,
      JSON.stringify({ name: a.name }),
    ]);
    await db.query("insert into public.profiles (user_id, name) values ($1, $2) on conflict (user_id) do update set name = excluded.name", [
      ids.get(a.email),
      a.name,
    ]);
  }
  await db.query("insert into public.platform_admins (user_id) values ($1)", [ids.get("super@demo.test")]);

  await asUser("super@demo.test");
  const demo = await one("select create_tenant('Arena Demo', 'arena-demo', 'dono@demo.test', 'completo') as id");
  const beta = await one("select create_tenant('Escola Beta', 'escola-beta', 'beta@demo.test', 'gestao') as id");
  await asUser("dono@demo.test");
  for (const [email, role] of [
    ["gestor@demo.test", "admin"],
    ["recepcao@demo.test", "staff"],
    ["prof@demo.test", "teacher"],
    ["aluno@demo.test", "student"],
  ]) {
    await db.query("select add_member($1, $2, $3)", [demo, email, role]);
  }
  await db.query("select set_config('request.jwt.claim.sub', '', false)");
  await db.query(
    `update public.tenants set settings = $2 where id = $1`,
    [demo, JSON.stringify({ phone: "(11) 4002-8922", instagram: "@arenademo", address: "Rua das Quadras, 100", primary_color: "#3fd8ff" })]
  );

  // --- Arena Demo: modalidades, professores, alunos, turmas
  const sport = async (name: string) => one("insert into public.sports (tenant_id, name) values ($1, $2) returning id", [demo, name]);
  const beach = await sport("Beach Tennis");
  const futevolei = await sport("Futevôlei");
  const jiu = await sport("Jiu-Jitsu");
  await one("insert into public.sports (tenant_id, name) values ($1, 'Vôlei de Praia') returning id", [beta]);

  const teacher = (name: string, phone: string, user: string | null = null) =>
    one("insert into public.teachers (tenant_id, name, phone, email, user_id) values ($1,$2,$3,$4,$5) returning id", [
      demo, name, phone, `${name.split(" ")[0].toLowerCase()}@demo.test`, user,
    ]);
  const carlos = await teacher("Carlos Professor", "(11) 98888-1111", ids.get("prof@demo.test")!);
  const ana = await teacher("Ana Souza", "(11) 98888-2222");
  const bruno = await teacher("Bruno Lima", "(11) 98888-3333");

  const names = [
    "João Aluno", "Maria Silva", "Pedro Alves", "Lucas Rocha", "Fernanda Costa", "Rafaela Dias",
    "Thiago Mendes", "Beatriz Nunes", "Gustavo Pires", "Larissa Melo", "Diego Ramos", "Camila Torres",
  ];
  const students: string[] = [];
  for (const [i, n] of names.entries()) {
    students.push(
      await one(
        "insert into public.students (tenant_id, name, phone, email, user_id, birth_date) values ($1,$2,$3,$4,$5,$6) returning id",
        [demo, n, `(11) 9${7000 + i}-${1000 + i * 7}`, `${n.split(" ")[0].toLowerCase()}${i}@exemplo.test`,
          i === 0 ? ids.get("aluno@demo.test") : null, `${1985 + i}-0${(i % 9) + 1}-15`]
      )
    );
  }

  const klass = async (name: string, sportId: string, teacherId: string, cap: number, fee: number, slots: [number, string, string][]) => {
    const id = await one(
      "insert into public.classes (tenant_id, sport_id, teacher_id, name, capacity, monthly_fee_cents) values ($1,$2,$3,$4,$5,$6) returning id",
      [demo, sportId, teacherId, name, cap, fee]
    );
    for (const [wd, s, e] of slots) {
      await db.query("insert into public.class_schedules (tenant_id, class_id, weekday, start_time, end_time) values ($1,$2,$3,$4,$5)", [demo, id, wd, s, e]);
    }
    return id;
  };
  const c1 = await klass("Beach Tennis Iniciante", beach, carlos, 8, 18000, [[1, "18:00", "19:00"], [3, "18:00", "19:00"]]);
  const c2 = await klass("Beach Tennis Avançado", beach, carlos, 6, 22000, [[2, "19:00", "20:30"], [4, "19:00", "20:30"]]);
  const c3 = await klass("Futevôlei Misto", futevolei, ana, 10, 16000, [[1, "07:00", "08:30"], [5, "07:00", "08:30"]]);
  const c4 = await klass("Jiu-Jitsu Adulto", jiu, bruno, 3, 20000, [[2, "20:00", "21:30"], [4, "20:00", "21:30"], [6, "10:00", "11:30"]]);

  // Matrículas (c4 tem capacidade 3 e fica lotada de propósito)
  const plan: [number, string, number][] = [
    [0, c1, 18000], [1, c1, 18000], [2, c1, 18000], [3, c2, 22000], [4, c2, 22000],
    [5, c3, 16000], [6, c3, 16000], [7, c3, 0], [8, c4, 20000], [9, c4, 20000], [10, c4, 20000],
    [0, c3, 16000], [11, c1, 18000],
  ];
  const enrollments: { id: string; student: string; fee: number }[] = [];
  for (const [s, c, fee] of plan) {
    const id = await one(
      "insert into public.enrollments (tenant_id, student_id, class_id, fee_cents, started_at) values ($1,$2,$3,$4, date_trunc('month', current_date)::date - interval '3 months') returning id",
      [demo, students[s], c, fee]
    );
    enrollments.push({ id, student: students[s], fee });
  }

  // Mensalidades: mês anterior (maioria paga, alguns em atraso) e mês atual (pendente)
  for (const [i, e] of enrollments.entries()) {
    const status = i % 4 === 3 ? "pending" : "paid";
    await db.query(
      `insert into public.invoices (tenant_id, student_id, enrollment_id, competence, amount_cents, due_date, status, paid_at, paid_amount_cents)
       values ($1,$2,$3, (date_trunc('month', current_date) - interval '1 month')::date, $4::int,
               (date_trunc('month', current_date) - interval '1 month')::date + 9, $5::text,
               case when $5::text = 'paid' then now() - interval '20 days' end,
               case when $5::text = 'paid' then $4::int end)`,
      [demo, e.student, e.id, e.fee, status]
    );
    const paidNow = i % 3 === 0;
    await db.query(
      `insert into public.invoices (tenant_id, student_id, enrollment_id, competence, amount_cents, due_date, status, paid_at, paid_amount_cents)
       values ($1,$2,$3, date_trunc('month', current_date)::date, $4::int, current_date + 5, $5::text,
               case when $5::text = 'paid' then now() - interval '2 days' end,
               case when $5::text = 'paid' then $4::int end)`,
      [demo, e.student, e.id, e.fee, paidNow ? "paid" : "pending"]
    );
  }

  // --- Ranking
  const ranking = await one(
    "insert into public.rankings (tenant_id, sport_id, name, season) values ($1,$2,'Ranking Beach Tennis','2026') returning id",
    [demo, beach]
  );
  const catOpen = await one("insert into public.ranking_categories (tenant_id, ranking_id, name) values ($1,$2,'Open') returning id", [demo, ranking]);
  const catIni = await one("insert into public.ranking_categories (tenant_id, ranking_id, name) values ($1,$2,'Iniciante') returning id", [demo, ranking]);
  const entry = (n: string, cat: string, student: string | null) =>
    one("insert into public.ranking_entries (tenant_id, ranking_id, category_id, student_id, name) values ($1,$2,$3,$4,$5) returning id", [demo, ranking, cat, student, n]);
  const entries = [
    await entry("João Aluno", catOpen, students[0]),
    await entry("Maria Silva", catOpen, students[1]),
    await entry("Pedro Alves", catIni, students[2]),
    await entry("Atleta Convidado", catIni, null),
  ];
  const pts: [number, number, string][] = [[0, 100, "Etapa 1"], [1, 80, "Etapa 1"], [0, 50, "Etapa 2"], [2, 60, "Etapa 1"], [3, 40, "Etapa 1"], [1, -10, "Ajuste manual"]];
  for (const [e, p, r] of pts) {
    await db.query("insert into public.ranking_point_events (tenant_id, entry_id, points, reason) values ($1,$2,$3,$4)", [demo, entries[e], p, r]);
  }

  // --- Campeonato
  const champ = await one(
    "insert into public.championships (tenant_id, sport_id, name, event_date, location, status, ranking_id) values ($1,$2,'Copa Verão de Beach Tennis', current_date + 30, 'Quadras da Arena Demo', 'open', $3) returning id",
    [demo, beach, ranking]
  );
  const cc = (n: string, g: string) =>
    one("insert into public.championship_categories (tenant_id, championship_id, name, gender) values ($1,$2,$3,$4) returning id", [demo, champ, n, g]);
  const ccM = await cc("Masculina Open", "M");
  const ccF = await cc("Feminina Open", "F");
  const regs: [string, string, string, string][] = [
    ["João Aluno", ccM, "M", "Arena Demo"], ["Pedro Alves", ccM, "M", "Arena Demo"], ["Lucas Rocha", ccM, "M", "Time Sol"],
    ["Thiago Mendes", ccM, "M", "Time Sol"], ["Maria Silva", ccF, "F", "Arena Demo"], ["Fernanda Costa", ccF, "F", "Time Mar"],
    ["Rafaela Dias", ccF, "F", "Time Mar"], ["Beatriz Nunes", ccF, "F", "Arena Demo"],
  ];
  for (const [i, [n, cat, g, team]] of regs.entries()) {
    await db.query(
      "insert into public.championship_registrations (tenant_id, championship_id, category_id, name, team, gender, fee_cents, status) values ($1,$2,$3,$4,$5,$6,8000,$7)",
      [demo, champ, cat, n, team, g, i % 5 === 4 ? "pending" : "confirmed"]
    );
  }
  for (const [p, v] of [[1, 100], [2, 70], [3, 50]]) {
    await db.query("insert into public.championship_points_rules (tenant_id, championship_id, placement, points) values ($1,$2,$3,$4)", [demo, champ, p, v]);
  }
  await db.query("insert into public.championship_expenses (tenant_id, championship_id, description, category, amount_cents) values ($1,$2,'Troféus','Premiação',25000), ($1,$2,'Arbitragem','Staff',18000)", [demo, champ]);

  // --- Escola Beta (isolamento visível ao trocar de conta)
  const betaClass = await one("select id from public.sports where tenant_id = $1", [beta]);
  await db.query("insert into public.students (tenant_id, name) values ($1,'Aluno da Beta')", [beta]);
  void betaClass;
}
