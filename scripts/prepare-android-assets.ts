import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const file = resolve("dist/public/index.html");
const html = await readFile(file, "utf8");
const csp =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self' https:; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-src 'none'";
await writeFile(
  file,
  html.replace(
    "<head>",
    `<head>\n<meta http-equiv="Content-Security-Policy" content="${csp}">`
  )
);
console.log(
  "Prepared bundled Android assets with a restrictive CSP; no server credentials included."
);
