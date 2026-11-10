import { API_BASE_URL } from "./config.js";

const OCCURRENCES_URL = `${API_BASE_URL}/api/ocorrencias`;
const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";

async function request(url, options = {}) {
    let response;
    try {
        response = await fetch(url, options);
    } catch (error) {
        throw new Error("Não foi possível conectar à API. Verifique se o backend está em execução.");
    }

    if (!response.ok) {
        const responseText = await response.text();
        let detail = responseText;
        try {
            const body = JSON.parse(responseText);
            detail = body.detail || body.message || body.error || responseText;
        } catch {
            // A API pode retornar texto simples em caso de erro.
        }
        throw new Error(detail || `A API respondeu com HTTP ${response.status}.`);
    }

    if (response.status === 204) {
        return null;
    }
    return response.json();
}

export function listarOcorrencias() {
    return request(OCCURRENCES_URL);
}

export function listarOcorrenciasPorArea(bounds) {
    const params = new URLSearchParams({
        minLatitude: String(bounds.minLatitude),
        minLongitude: String(bounds.minLongitude),
        maxLatitude: String(bounds.maxLatitude),
        maxLongitude: String(bounds.maxLongitude)
    });
    return request(`${OCCURRENCES_URL}/area?${params.toString()}`);
}

export function listarOcorrenciasProximas(latitude, longitude, raioMetros = 2000) {
    const params = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        raioMetros: String(raioMetros)
    });
    return request(`${OCCURRENCES_URL}/proximas?${params.toString()}`);
}

export async function buscarLocalidades(query, signal) {
    const params = new URLSearchParams({
        q: query,
        format: "jsonv2",
        addressdetails: "1",
        limit: "5",
        "accept-language": "pt-BR"
    });

    let response;
    try {
        response = await fetch(`${NOMINATIM_SEARCH_URL}?${params.toString()}`, {
            headers: { Accept: "application/json" },
            referrerPolicy: "strict-origin-when-cross-origin",
            signal
        });
    } catch (error) {
        if (error.name === "AbortError") {
            throw error;
        }
        throw new Error("Não foi possível conectar ao serviço de busca de endereços.");
    }

    if (!response.ok) {
        throw new Error(`O serviço de busca respondeu com HTTP ${response.status}.`);
    }

    const results = await response.json();
    if (!Array.isArray(results)) {
        throw new Error("O serviço de busca retornou uma resposta inválida.");
    }
    return results;
}

export function cadastrarOcorrencia(ocorrencia) {
    return request(OCCURRENCES_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(ocorrencia)
    });
}

export function atualizarOcorrencia(id, ocorrencia) {
    return request(`${OCCURRENCES_URL}/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(ocorrencia)
    });
}

export function excluirOcorrencia(id) {
    return request(`${OCCURRENCES_URL}/${encodeURIComponent(id)}`, {
        method: "DELETE"
    });
}
