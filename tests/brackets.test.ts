// Testes do motor de chaves. Rodar: npm run test:brackets
import assert from "node:assert/strict";
import {
  buildRounds, championOf, emptyWinners, placementsOf, sanitizeWinners, seedSlots, type Participant,
} from "../app/_lib/brackets.ts";

const people = (n: number, team?: (i: number) => string | null): Participant[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Atleta ${i}`, team: team ? team(i) : null }));
const index = (ps: Participant[]) => new Map(ps.map((p) => [p.id, p]));

// formato das rodadas
assert.deepEqual(emptyWinners(4).map((r) => r.length), [2, 1]);
assert.deepEqual(emptyWinners(5).map((r) => r.length), [2, 1, 1]); // o 5º avança direto
assert.deepEqual(emptyWinners(8).map((r) => r.length), [4, 2, 1]);
assert.deepEqual(emptyWinners(1), []);

// 4 atletas: campeão, vice e dois 3º
{
  const ps = people(4);
  const slots = ps.map((p) => p.id);
  const w = emptyWinners(4);
  w[0][0] = "top"; // p0 > p1
  w[0][1] = "bottom"; // p3 > p2
  w[1][0] = "bottom"; // final: p3 > p0
  const rounds = buildRounds(slots, index(ps), w);
  assert.equal(rounds.map((r) => r.title).join(","), "Semifinal,Final");
  assert.equal(championOf(rounds)?.id, "p3");
  const pl = placementsOf(rounds);
  assert.deepEqual(pl.filter((x) => x.placement === 1).map((x) => x.participantId), ["p3"]);
  assert.deepEqual(pl.filter((x) => x.placement === 2).map((x) => x.participantId), ["p0"]);
  assert.deepEqual(pl.filter((x) => x.placement === 3).map((x) => x.participantId).sort(), ["p1", "p2"]);
}

// sem final decidida, não há colocações
{
  const ps = people(4);
  const rounds = buildRounds(ps.map((p) => p.id), index(ps), emptyWinners(4));
  assert.deepEqual(placementsOf(rounds), []);
  assert.equal(championOf(rounds), null);
}

// 5 atletas: o último avança direto
{
  const ps = people(5);
  const w = emptyWinners(5);
  const rounds = buildRounds(ps.map((p) => p.id), index(ps), w);
  assert.deepEqual(rounds.map((r) => r.matches.length), [2, 1, 1]);
  assert.equal(rounds[1].matches[0].bottom.label, "Vencedor da luta 2");
  assert.equal(rounds[2].matches[0].bottom.participant?.id, "p4"); // o carry chega à final sem lutar
}

// vencedor inválido (lado vazio) é ignorado
{
  const slots = ["p0", null];
  const ps = people(1);
  const rounds = buildRounds(slots, index(ps), [["bottom"]]);
  assert.equal(rounds[0].matches[0].winner, null);
}

// sanitizeWinners descarta lixo e ajusta ao formato
{
  const s = sanitizeWinners(4, [["top", "xyz"], ["bottom"], ["extra"]]);
  assert.deepEqual(s, [["top", null], ["bottom"]]);
  assert.deepEqual(sanitizeWinners(4, "lixo"), [[null, null], [null]]);
}

// seeding separa colegas de equipe quando possível
{
  const ps = people(8, (i) => (i < 4 ? "Equipe A" : "Equipe B"));
  const order = seedSlots(ps);
  const byId = index(ps);
  for (let i = 0; i < order.length; i += 2) {
    assert.notEqual(byId.get(order[i])!.team, byId.get(order[i + 1])!.team, `par ${i / 2} com a mesma equipe`);
  }
  assert.equal(new Set(order).size, 8);
}

// seeding não perde nem duplica ninguém
{
  const ps = people(7, (i) => (i % 3 === 0 ? "X" : null));
  assert.deepEqual([...seedSlots(ps)].sort(), ps.map((p) => p.id).sort());
}

console.log("Motor de chaves: todos os testes passaram.");
