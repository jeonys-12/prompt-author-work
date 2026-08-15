import { readFile, writeFile } from "node:fs/promises";

const projectPath = "/prompt-author-work";
const indexPath = new URL("../dist/client/index.html", import.meta.url);
const html = await readFile(indexPath, "utf8");

const prepared = html
  .replaceAll(`${projectPath}${projectPath}/assets/`, `${projectPath}/assets/`)
  .replaceAll(/(?<!\/prompt-author-work)\/assets\//g, `${projectPath}/assets/`)
  .replaceAll('href="/favicon.svg"', `href="${projectPath}/favicon.svg"`);

await writeFile(indexPath, prepared);
