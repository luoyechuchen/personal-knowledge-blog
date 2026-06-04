import { mkdir, writeFile } from "node:fs/promises";

const version =
  process.env.GITHUB_SHA ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.CF_PAGES_COMMIT_SHA ||
  "local-dev";

const deployInfo = {
  version
};

await mkdir("public", { recursive: true });
await writeFile("public/deploy.json", `${JSON.stringify(deployInfo, null, 2)}\n`);
