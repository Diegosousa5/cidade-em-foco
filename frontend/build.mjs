import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const frontendDirectory = path.dirname(fileURLToPath(import.meta.url));
const outputDirectory = path.join(frontendDirectory, "dist");
const apiBaseUrl = process.env.API_BASE_URL?.trim();

if (!apiBaseUrl) {
    throw new Error("Defina API_BASE_URL com a URL pública do backend antes de gerar o frontend.");
}

let parsedApiUrl;
try {
    parsedApiUrl = new URL(apiBaseUrl);
} catch {
    throw new Error("API_BASE_URL deve ser uma URL válida HTTPS.");
}

if (parsedApiUrl.protocol !== "https:" || parsedApiUrl.username || parsedApiUrl.password) {
    throw new Error("API_BASE_URL deve usar HTTPS e não pode conter credenciais.");
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await cp(path.join(frontendDirectory, "index.html"), path.join(outputDirectory, "index.html"));
await cp(path.join(frontendDirectory, "css"), path.join(outputDirectory, "css"), { recursive: true });
await cp(path.join(frontendDirectory, "js"), path.join(outputDirectory, "js"), { recursive: true });
await writeFile(
    path.join(outputDirectory, "js", "runtime-config.js"),
    `window.CIDADE_EM_FOCO_API_URL = ${JSON.stringify(apiBaseUrl.replace(/\/+$/, ""))};\n`,
    "utf8"
);
