// Copies the static export (web/out) into the server's embed directory (internal/web/ui), replacing what is
// there except its .gitignore, which is the only file of that directory kept in Git.
import { cpSync, existsSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(web, "out");
const target = join(web, "..", "internal", "web", "ui");

if (!existsSync(join(source, "index.html"))) {
  throw new Error(`${source} has no export; run "npm run build" first.`);
}
for (const entry of readdirSync(target)) {
  if (entry !== ".gitignore") {
    rmSync(join(target, entry), { recursive: true });
  }
}
cpSync(source, target, { recursive: true });
console.log(`embedded ${source} into ${target}`);
