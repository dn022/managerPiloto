// Sobe o app em modo demo: banco embutido com dados de exemplo, sem Supabase.
import { spawn } from "node:child_process";

const child = spawn("npx", ["next", "dev"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, DEMO_MODE: "1" },
});
child.on("exit", (code) => process.exit(code ?? 0));
