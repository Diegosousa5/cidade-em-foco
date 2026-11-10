const LOCAL_API_URL = "http://localhost:8080";

const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const configuredApiUrl = isLocal
    ? LOCAL_API_URL
    : (window.CIDADE_EM_FOCO_API_URL || "");
export const API_BASE_URL = configuredApiUrl.replace(/\/+$/, "");

if (!API_BASE_URL) {
    throw new Error("Configure a variável API_BASE_URL no build do frontend para produção.");
}
