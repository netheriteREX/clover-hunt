// Builds lambda-build/function.zip for upload to AWS Lambda: the server/
// folder plus only the production dependencies the backend actually needs.
// Run with: npm run package:lambda
import fs from "fs";
import path from "path";
import { execSync, execFileSync } from "child_process";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "lambda-build");
const stageDir = path.join(outDir, "stage");

const rootPkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const serverDeps = ["express", "cors", "dotenv", "@anthropic-ai/sdk", "serverless-http"];

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(stageDir, { recursive: true });

for (const file of ["index.js", "lambda.js", "prompts.js", "search.js"]) {
  fs.copyFileSync(path.join(root, "server", file), path.join(stageDir, file));
}

const dependencies = Object.fromEntries(serverDeps.map((name) => [name, rootPkg.dependencies[name]]));
fs.writeFileSync(
  path.join(stageDir, "package.json"),
  JSON.stringify({ name: "debate-api", type: "module", dependencies }, null, 2),
);

execSync("npm install --omit=dev --no-audit --no-fund", { cwd: stageDir, stdio: "inherit" });

// Lambda needs forward-slash paths inside the zip. On Windows, use the
// bundled bsdtar by absolute path (a Git Bash `tar` earlier on PATH is GNU
// tar, which can't write zips) — Compress-Archive in Windows PowerShell 5.1
// writes backslashes. Elsewhere, use the standard `zip`.
const zipPath = path.join(outDir, "function.zip");
if (process.platform === "win32") {
  const bsdtar = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe");
  // Entries are listed by name rather than "." so paths don't get a "./"
  // prefix, which Windows' zip viewer and Lambda both choke on.
  const entries = fs.readdirSync(stageDir);
  execFileSync(bsdtar, ["-a", "-c", "-f", zipPath, "-C", stageDir, ...entries], { stdio: "inherit" });
} else {
  execFileSync("zip", ["-r", "-q", zipPath, "."], { cwd: stageDir, stdio: "inherit" });
}

console.log(`\nCreated ${zipPath} (${(fs.statSync(zipPath).size / 1024 / 1024).toFixed(1)} MB)`);
