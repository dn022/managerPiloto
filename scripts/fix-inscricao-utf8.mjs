import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const files = [
  "app/_components/inscricao/AthleteInfoSection.tsx",
  "app/_components/inscricao/AthleteDetailsSection.tsx",
  "app/_components/inscricao/ModalitiesSection.tsx",
  "app/_components/inscricao/TermsSection.tsx",
];

const pairs = [
  {
    from: Buffer.from([0x52, 0x65, 0x73, 0x70, 0x6f, 0x6e, 0x73, 0xe1, 0x76, 0x65, 0x6c]),
    to: "Responsável",
  },
  {
    from: Buffer.from([0x72, 0x65, 0x73, 0x70, 0x6f, 0x6e, 0x73, 0xe1, 0x76, 0x65, 0x6c]),
    to: "responsável",
  },
  { from: Buffer.from([0x47, 0xea, 0x6e, 0x65, 0x72, 0x6f]), to: "Gênero" },
  {
    from: Buffer.from([
      0x65, 0x78, 0x70, 0x65, 0x72, 0x69, 0xea, 0x6e, 0x63, 0x69, 0x61,
    ]),
    to: "experiência",
  },
  {
    from: Buffer.from([0x44, 0x69, 0x76, 0x69, 0x73, 0xe3, 0x6f]),
    to: "Divisão",
  },
];

function replaceAll(buf, search, replUtf8) {
  const repl = Buffer.from(replUtf8, "utf8");
  const parts = [];
  let i = 0;
  while (i < buf.length) {
    const idx = buf.indexOf(search, i);
    if (idx === -1) {
      parts.push(buf.subarray(i));
      break;
    }
    parts.push(buf.subarray(i, idx), repl);
    i = idx + search.length;
  }
  return Buffer.concat(parts);
}

for (const rel of files) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) continue;
  let b = fs.readFileSync(p);
  for (const { from, to } of pairs) {
    b = replaceAll(b, from, to);
  }
  fs.writeFileSync(p, b);
  try {
    new TextDecoder("utf8", { fatal: true }).decode(fs.readFileSync(p));
    console.log("OK", rel);
  } catch (e) {
    console.log("STILL BAD", rel, String(e));
  }
}
