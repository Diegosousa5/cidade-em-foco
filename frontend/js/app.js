
import {
    atualizarOcorrencia,
    buscarLocalidades,
    cadastrarOcorrencia,
    excluirOcorrencia,
    listarOcorrenciasPorArea,
    listarOcorrenciasProximas
} from "./api.js";

const categorias = new Set([
    "buracos",
    "iluminação pública",
    "lixo",
    "esgoto",
    "calçadas",
    "espaços públicos"
]);
const OUTRA_CATEGORIA = "outro";
const MAPA_INICIAL = [-23.5505, -46.6333];
const MAPA_VIEW_STORAGE_KEY = "cidade-em-foco-main-map-view";
const LEAFLET_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const LEAFLET_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const CATEGORIA_MARKER_CLASS = new Map([
    ["buracos", "occurrence-marker--buracos"],
    ["iluminação pública", "occurrence-marker--iluminacao"],
    ["lixo", "occurrence-marker--lixo"],
    ["esgoto", "occurrence-marker--esgoto"],
    ["calçadas", "occurrence-marker--calcadas"],
    ["espaços públicos", "occurrence-marker--espacos"]
]);

const form = document.querySelector("#occurrence-form");
const formMessage = document.querySelector("#form-message");
const listMessage = document.querySelector("#list-message");
const occurrencesList = document.querySelector("#occurrences-list");
const submitButton = form.querySelector('button[type="submit"]');
const refreshButton = document.querySelector("#refresh-button");
const editDialog = document.querySelector("#edit-dialog");
const editForm = document.querySelector("#edit-form");
const editMessage = document.querySelector("#edit-message");
const saveEditButton = document.querySelector("#save-edit-button");
const closeEditButton = document.querySelector("#close-edit-button");
const cancelEditButton = document.querySelector("#cancel-edit-button");
const mainMapMessage = document.querySelector("#main-map-message");
const mainMapLocationButton = document.querySelector("#main-map-location-button");
const nearbySearchButton = document.querySelector("#nearby-search-button");
const returnAreaButton = document.querySelector("#return-area-button");
const radiusSelect = document.querySelector("#radius-select");

let ocorrenciasAtuais = [];
let ocorrenciaEmEdicaoId = null;
let mapaPrincipal;
let camadaMarcadores;
let camadaBuscaProxima;
let mapaPrincipalInteragido = false;
let modoVisualizacao = "area";
let centroBuscaProxima = null;
let requisicaoEmAndamento = false;
let recarregarPendente = false;
let temporizadorRecarregar;
let versaoConsulta = 0;
let buscaNominatimEmAndamento = false;
let ultimaBuscaNominatimEm = 0;

// Obtém o raio selecionado no HTML, em metros.
function obterRaioBuscaMetros() {
    const raio = Number(radiusSelect.value);

    return Number.isFinite(raio) && raio > 0
        ? raio
        : 2000;
}

// Formata o raio para exibição nas mensagens.
function formatarRaio(raioMetros) {
    if (raioMetros >= 1000) {
        return `${(raioMetros / 1000).toLocaleString("pt-BR")} km`;
    }

    return `${raioMetros} metros`;
}

function showMessage(element, message, type = "") {
    element.textContent = message;
    element.className = `message${type ? ` message--${type}` : ""}`;
}

function criarMapaLeaflet(containerId, center, zoom) {
    const map = window.L.map(containerId).setView(center, zoom);

    window.L.tileLayer(LEAFLET_TILE_URL, {
        maxZoom: 19,
        attribution: LEAFLET_ATTRIBUTION
    }).addTo(map);

    return map;
}

function classeMarcadorCategoria(categoria) {
    return CATEGORIA_MARKER_CLASS.get(categoria)
        ?? "occurrence-marker--personalizada";
}

function criarIconeOcorrencia(categoria) {
    return window.L.divIcon({
        className: "",
        html: `<span class="occurrence-marker ${classeMarcadorCategoria(categoria)}"></span>`,
        iconSize: [18, 25],
        iconAnchor: [9, 25],
        popupAnchor: [0, -25]
    });
}

function criarPopupOcorrencia(ocorrencia) {
    const popup = document.createElement("div");
    popup.className = "occurrence-popup";

    popup.append(
        criarTexto("h3", "", ocorrencia.titulo),
        criarDetalhe("Descrição", ocorrencia.descricao),
        criarDetalhe("Categoria", ocorrencia.categoria),
        criarDetalhe("Endereço", ocorrencia.endereco),
        criarDetalhe("Status", ocorrencia.status),
        criarDetalhe("Criada em", formatarData(ocorrencia.dataCriacao))
    );

    return popup;
}

function renderizarMarcadores() {
    if (!camadaMarcadores) {
        return;
    }

    camadaMarcadores.clearLayers();

    let totalLocalizacoesValidas = 0;

    for (const ocorrencia of ocorrenciasAtuais) {
        const latitude = Number(ocorrencia.latitude);
        const longitude = Number(ocorrencia.longitude);

        if (
            !Number.isFinite(latitude)
            || latitude < -90
            || latitude > 90
            || !Number.isFinite(longitude)
            || longitude < -180
            || longitude > 180
        ) {
            continue;
        }

        const marker = window.L.marker([latitude, longitude], {
            icon: criarIconeOcorrencia(ocorrencia.categoria)
        });

        marker.bindPopup(criarPopupOcorrencia(ocorrencia));
        marker.addTo(camadaMarcadores);

        totalLocalizacoesValidas += 1;
    }

    if (modoVisualizacao === "proximas") {
        const raioFormatado = formatarRaio(obterRaioBuscaMetros());

        showMessage(
            mainMapMessage,
            totalLocalizacoesValidas
                ? `${totalLocalizacoesValidas} ocorrência(s) encontrada(s) em até ${raioFormatado}.`
                : `Nenhuma ocorrência encontrada em até ${raioFormatado} da sua localização.`
        );
    } else if (totalLocalizacoesValidas !== ocorrenciasAtuais.length) {
        showMessage(
            mainMapMessage,
            `${totalLocalizacoesValidas} de ${ocorrenciasAtuais.length} ocorrências têm localização válida para exibição.`,
            totalLocalizacoesValidas ? "" : "error"
        );
    } else {
        showMessage(
            mainMapMessage,
            totalLocalizacoesValidas
                ? `${totalLocalizacoesValidas} ocorrências exibidas no mapa.`
                : "Ainda não há ocorrências cadastradas."
        );
    }
}

function atualizarCamadaBuscaProxima() {
    if (!camadaBuscaProxima) {
        return;
    }

    camadaBuscaProxima.clearLayers();

    if (!centroBuscaProxima) {
        return;
    }

    const center = [
        centroBuscaProxima.latitude,
        centroBuscaProxima.longitude
    ];

    window.L.circle(center, {
        radius: obterRaioBuscaMetros(),
        color: "#25836b",
        weight: 2,
        fillColor: "#25836b",
        fillOpacity: 0.12
    }).addTo(camadaBuscaProxima);

    window.L.circleMarker(center, {
        radius: 8,
        color: "#fff",
        weight: 3,
        fillColor: "#123c35",
        fillOpacity: 1
    })
        .bindTooltip("Sua localização")
        .addTo(camadaBuscaProxima);
}

function mostrarOcorrenciasProximas() {
    if (!navigator.geolocation) {
        showMessage(
            mainMapMessage,
            "Este navegador não oferece geolocalização. Habilite a permissão ou volte à área visível.",
            "error"
        );
        return;
    }

    nearbySearchButton.disabled = true;
    showMessage(mainMapMessage, "Obtendo sua localização...");

    navigator.geolocation.getCurrentPosition(
        (position) => {
            centroBuscaProxima = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            };

            modoVisualizacao = "proximas";
            returnAreaButton.hidden = false;

            atualizarCamadaBuscaProxima();

            mapaPrincipalInteragido = true;

            mapaPrincipal.setView(
                [
                    centroBuscaProxima.latitude,
                    centroBuscaProxima.longitude
                ],
                14
            );

            void recarregarOcorrenciasDaVisualizacao();

            nearbySearchButton.disabled = false;
        },
        (error) => {
            const explanation = error.code === error.PERMISSION_DENIED
                ? "A permissão de localização foi negada. Habilite-a nas configurações do site/navegador e tente novamente."
                : error.code === error.POSITION_UNAVAILABLE
                    ? "Sua localização atual não está disponível. Confira os serviços de localização do dispositivo."
                    : "A busca da localização excedeu o tempo limite. Tente novamente.";

            showMessage(mainMapMessage, explanation, "error");
            nearbySearchButton.disabled = false;
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
        }
    );
}

function voltarParaAreaVisivel() {
    modoVisualizacao = "area";
    centroBuscaProxima = null;
    returnAreaButton.hidden = true;

    atualizarCamadaBuscaProxima();
    agendarCarregamentoArea(0);
}

function salvarVisualizacaoMapa() {
    const center = mapaPrincipal.getCenter();

    sessionStorage.setItem(
        MAPA_VIEW_STORAGE_KEY,
        JSON.stringify({
            latitude: center.lat,
            longitude: center.lng,
            zoom: mapaPrincipal.getZoom()
        })
    );
}

function obterVisualizacaoSalva() {
    const savedView = sessionStorage.getItem(MAPA_VIEW_STORAGE_KEY);

    if (!savedView) {
        return null;
    }

    try {
        const view = JSON.parse(savedView);

        if (
            Number.isFinite(view.latitude)
            && view.latitude >= -90
            && view.latitude <= 90
            && Number.isFinite(view.longitude)
            && view.longitude >= -180
            && view.longitude <= 180
            && Number.isFinite(view.zoom)
            && view.zoom >= 1
            && view.zoom <= 19
        ) {
            return view;
        }
    } catch (error) {
        if (!(error instanceof SyntaxError)) {
            throw error;
        }
    }

    sessionStorage.removeItem(MAPA_VIEW_STORAGE_KEY);
    return null;
}

function focarMapaNaOcorrencia(ocorrencia, fallbackLocation) {
    const latitude = Number(
        ocorrencia?.latitude ?? fallbackLocation.latitude
    );
    const longitude = Number(
        ocorrencia?.longitude ?? fallbackLocation.longitude
    );

    if (
        !Number.isFinite(latitude)
        || !Number.isFinite(longitude)
        || latitude < -90
        || latitude > 90
        || longitude < -180
        || longitude > 180
    ) {
        return;
    }

    modoVisualizacao = "area";
    centroBuscaProxima = null;
    returnAreaButton.hidden = true;

    atualizarCamadaBuscaProxima();

    mapaPrincipalInteragido = true;

    mapaPrincipal.setView(
        [latitude, longitude],
        Math.max(mapaPrincipal.getZoom(), 15)
    );
}

function solicitarLocalizacaoPrincipal() {
    if (!navigator.geolocation) {
        showMessage(
            mainMapMessage,
            "Geolocalização não está disponível neste navegador. O mapa mostra a região padrão.",
            "error"
        );
        return;
    }

    mainMapLocationButton.disabled = true;

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const center = [
                position.coords.latitude,
                position.coords.longitude
            ];

            mapaPrincipal.setView(center, 14);
            mapaPrincipalInteragido = true;
            mainMapLocationButton.disabled = false;
        },
        (error) => {
            const explanation = error.code === error.PERMISSION_DENIED
                ? "Permissão de localização negada."
                : error.code === error.POSITION_UNAVAILABLE
                    ? "Sua localização atual não está disponível."
                    : "A busca da localização excedeu o tempo limite.";

            showMessage(
                mainMapMessage,
                `${explanation} O mapa mostra a região padrão.`,
                "error"
            );

            mainMapLocationButton.disabled = false;
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
        }
    );
}

function inicializarMapaPrincipal() {
    if (!window.L) {
        showMessage(
            mainMapMessage,
            "Não foi possível carregar o mapa. Verifique sua conexão e recarregue a página.",
            "error"
        );

        mainMapLocationButton.disabled = true;
        return;
    }

    const savedView = obterVisualizacaoSalva();

    mapaPrincipal = criarMapaLeaflet(
        "main-map",
        savedView
            ? [savedView.latitude, savedView.longitude]
            : MAPA_INICIAL,
        savedView?.zoom ?? 12
    );

    if (savedView) {
        mapaPrincipalInteragido = true;
    }

    camadaMarcadores = window.L.layerGroup().addTo(mapaPrincipal);
    camadaBuscaProxima = window.L.layerGroup().addTo(mapaPrincipal);

    mapaPrincipal.on("dragstart zoomstart", () => {
        mapaPrincipalInteragido = true;
    });

    mapaPrincipal.on("moveend", () => {
        salvarVisualizacaoMapa();

        if (modoVisualizacao === "area") {
            agendarCarregamentoArea();
        }
    });

    requestAnimationFrame(() => mapaPrincipal.invalidateSize());

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                if (!mapaPrincipalInteragido) {
                    mapaPrincipal.setView(
                        [
                            position.coords.latitude,
                            position.coords.longitude
                        ],
                        14
                    );
                }
            },
            () => showMessage(
                mainMapMessage,
                "Localização atual indisponível; mostrando a região padrão. Use o botão para tentar novamente."
            ),
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    } else {
        showMessage(
            mainMapMessage,
            "Geolocalização não disponível; mostrando a região padrão."
        );
    }

    agendarCarregamentoArea(0);
}

function criarSeletorCategoriaPersonalizada(targetForm, fieldId) {
    const categorySelect = targetForm.elements.namedItem("categoria");
    const customCategoryInput = targetForm.elements.namedItem(
        "categoriaPersonalizadaNome"
    );
    const customCategoryField = document.querySelector(`#${fieldId}`);

    function atualizarVisibilidade() {
        const isCustom = categorySelect.value === OUTRA_CATEGORIA;

        customCategoryField.hidden = !isCustom;
        customCategoryInput.required = isCustom;
    }

    categorySelect.addEventListener("change", atualizarVisibilidade);
    atualizarVisibilidade();

    return {
        categorySelect,
        customCategoryInput,
        atualizarVisibilidade
    };
}

const createCategory = criarSeletorCategoriaPersonalizada(
    form,
    "custom-category-field"
);

const editCategory = criarSeletorCategoriaPersonalizada(
    editForm,
    "edit-custom-category-field"
);

function criarSeletorLocalizacao({
    targetForm,
    mapId,
    messageId,
    geolocationButtonId
}) {
    const latitudeInput = targetForm.elements.namedItem("latitude");
    const longitudeInput = targetForm.elements.namedItem("longitude");
    const message = document.querySelector(`#${messageId}`);
    const geolocationButton = document.querySelector(
        `#${geolocationButtonId}`
    );

    let map;
    let marker;

    function atualizarCoordenadas(latlng, centerMap = false) {
        if (
            !Number.isFinite(latlng.lat)
            || !Number.isFinite(latlng.lng)
            || latlng.lat < -90
            || latlng.lat > 90
            || latlng.lng < -180
            || latlng.lng > 180
        ) {
            showMessage(
                message,
                "O ponto selecionado não possui coordenadas válidas.",
                "error"
            );
            return;
        }

        latitudeInput.value = String(latlng.lat);
        longitudeInput.value = String(latlng.lng);

        if (!marker) {
            marker = window.L.marker(latlng, {
                draggable: true
            }).addTo(map);

            marker.on("dragend", () => {
                atualizarCoordenadas(marker.getLatLng());
            });
        } else {
            marker.setLatLng(latlng);
        }

        if (centerMap) {
            map.setView(latlng, Math.max(map.getZoom(), 15));
        }

        showMessage(
            message,
            `Local selecionado: ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}.`,
            "success"
        );
    }

    function initialize(initialLocation = null) {
        if (!window.L) {
            showMessage(
                message,
                "Não foi possível carregar o mapa. Verifique sua conexão e recarregue a página.",
                "error"
            );
            return false;
        }

        if (!map) {
            map = criarMapaLeaflet(mapId, MAPA_INICIAL, 12);

            map.on("click", (event) => {
                atualizarCoordenadas(event.latlng);
            });
        }

        if (initialLocation) {
            atualizarCoordenadas(
                window.L.latLng(
                    initialLocation[0],
                    initialLocation[1]
                ),
                true
            );
        }

        requestAnimationFrame(() => map.invalidateSize());

        return true;
    }

    function obterCoordenadas() {
        if (
            latitudeInput.value.trim() === ""
            || longitudeInput.value.trim() === ""
        ) {
            return null;
        }

        const latitude = Number(latitudeInput.value);
        const longitude = Number(longitudeInput.value);

        return Number.isFinite(latitude) && Number.isFinite(longitude)
            ? { latitude, longitude }
            : null;
    }

    function selecionarLocalizacao(latitude, longitude) {
        if (!initialize()) {
            return false;
        }

        atualizarCoordenadas(
            window.L.latLng(latitude, longitude),
            true
        );

        return obterCoordenadas() !== null;
    }

    function limpar() {
        latitudeInput.value = "";
        longitudeInput.value = "";

        if (marker && map) {
            map.removeLayer(marker);
            marker = null;
        }

        showMessage(message, "Selecione uma localização no mapa.");
    }

    geolocationButton.addEventListener("click", () => {
        if (!navigator.geolocation) {
            showMessage(
                message,
                "Seu navegador não oferece geolocalização. Escolha o ponto manualmente no mapa.",
                "error"
            );
            return;
        }

        if (!initialize()) {
            return;
        }

        geolocationButton.disabled = true;
        showMessage(message, "Obtendo sua localização...");

        navigator.geolocation.getCurrentPosition(
            (position) => {
                atualizarCoordenadas(
                    {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    },
                    true
                );

                geolocationButton.disabled = false;
            },
            (error) => {
                const explanation = error.code === error.PERMISSION_DENIED
                    ? "Permissão de localização negada."
                    : error.code === error.POSITION_UNAVAILABLE
                        ? "Sua localização atual não está disponível."
                        : "A busca da localização excedeu o tempo limite.";

                showMessage(
                    message,
                    `${explanation} Escolha o ponto manualmente no mapa.`,
                    "error"
                );

                geolocationButton.disabled = false;
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    });

    return {
        initialize,
        obterCoordenadas,
        limpar,
        selecionarLocalizacao
    };
}

const createLocation = criarSeletorLocalizacao({
    targetForm: form,
    mapId: "create-map",
    messageId: "create-location-message",
    geolocationButtonId: "create-geolocation-button"
});

const editLocation = criarSeletorLocalizacao({
    targetForm: editForm,
    mapId: "edit-map",
    messageId: "edit-location-message",
    geolocationButtonId: "edit-geolocation-button"
});

createLocation.initialize();

function configurarBuscaNominatim({
    targetForm,
    locationPicker
}) {
    const searchContainer = targetForm.querySelector(
        "[data-geocoding-search]"
    );
    const queryInput = searchContainer.querySelector(
        'input[type="search"]'
    );
    const searchButton = searchContainer.querySelector(
        "[data-geocode-search]"
    );
    const message = searchContainer.querySelector(
        "[data-geocode-message]"
    );
    const resultsContainer = searchContainer.querySelector(
        "[data-geocode-results]"
    );
    const addressInput = targetForm.elements.namedItem("endereco");

    function renderizarResultados(results) {
        resultsContainer.replaceChildren();

        for (const result of results) {
            const latitude = Number(result.lat);
            const longitude = Number(result.lon);

            if (
                !Number.isFinite(latitude)
                || latitude < -90
                || latitude > 90
                || !Number.isFinite(longitude)
                || longitude < -180
                || longitude > 180
                || typeof result.display_name !== "string"
                || !result.display_name.trim()
            ) {
                continue;
            }

            const button = document.createElement("button");
            button.type = "button";
            button.className = "geocoding-result";
            button.textContent = result.display_name;

            button.addEventListener("click", () => {
                if (
                    !locationPicker.selecionarLocalizacao(
                        latitude,
                        longitude
                    )
                ) {
                    showMessage(
                        message,
                        "Não foi possível aplicar a localização selecionada.",
                        "error"
                    );
                    return;
                }

                addressInput.value = result.display_name
                    .slice(0, 255)
                    .trim();

                showMessage(
                    message,
                    "Localização selecionada. Você ainda pode ajustar o marcador no mapa.",
                    "success"
                );

                resultsContainer.replaceChildren();
            });

            resultsContainer.append(button);
        }
    }

    async function pesquisar() {
        const query = queryInput.value.trim();

        resultsContainer.replaceChildren();

        if (query.length < 3) {
            showMessage(
                message,
                "Digite pelo menos 3 caracteres para pesquisar.",
                "error"
            );

            queryInput.focus();
            return;
        }

        if (buscaNominatimEmAndamento) {
            showMessage(
                message,
                "Outra pesquisa está em andamento. Aguarde a conclusão.",
                "error"
            );
            return;
        }

        buscaNominatimEmAndamento = true;
        searchButton.disabled = true;

        const intervaloRestante = Math.max(
            0,
            1100 - (Date.now() - ultimaBuscaNominatimEm)
        );

        if (intervaloRestante > 0) {
            showMessage(
                message,
                "Aguarde um instante antes da próxima pesquisa..."
            );

            await new Promise((resolve) => {
                window.setTimeout(resolve, intervaloRestante);
            });
        }

        try {
            ultimaBuscaNominatimEm = Date.now();

            showMessage(message, "Pesquisando localidades...");

            const results = await buscarLocalidades(query);

            renderizarResultados(results);

            const count = resultsContainer.childElementCount;

            showMessage(
                message,
                count === 0
                    ? "Nenhuma localidade encontrada. Tente outro termo ou escolha o ponto manualmente no mapa."
                    : `${count} resultado(s). Selecione uma opção para posicionar o marcador.`,
                count === 0 ? "" : "success"
            );
        } catch (error) {
            showMessage(
                message,
                error.message || "Não foi possível pesquisar localidades.",
                "error"
            );
        } finally {
            buscaNominatimEmAndamento = false;
            searchButton.disabled = false;
        }
    }

    searchButton.addEventListener("click", () => {
        void pesquisar();
    });

    queryInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            void pesquisar();
        }
    });
}

configurarBuscaNominatim({
    targetForm: form,
    locationPicker: createLocation
});

configurarBuscaNominatim({
    targetForm: editForm,
    locationPicker: editLocation
});

function validarFormulario(data) {
    if (
        !data.titulo.trim()
        || !data.descricao.trim()
        || !data.categoria.trim()
        || !data.endereco.trim()
    ) {
        return "Preencha todos os campos obrigatórios.";
    }

    if (data.titulo.trim().length > 120) {
        return "O título deve ter no máximo 120 caracteres.";
    }

    if (data.endereco.trim().length > 255) {
        return "O endereço deve ter no máximo 255 caracteres.";
    }

    if (data.categoriaPersonalizada) {
        if (!data.categoria.trim()) {
            return "Informe o nome da categoria personalizada.";
        }

        if (data.categoria.trim().length > 40) {
            return "A categoria personalizada deve ter no máximo 40 caracteres.";
        }
    } else if (!categorias.has(data.categoria)) {
        return "Selecione uma categoria válida.";
    }

    if (
        !Number.isFinite(data.latitude)
        || data.latitude < -90
        || data.latitude > 90
        || !Number.isFinite(data.longitude)
        || data.longitude < -180
        || data.longitude > 180
    ) {
        return "Selecione uma localização válida no mapa ou use sua localização atual.";
    }

    return "";
}

function obterDadosFormulario(
    targetForm,
    locationPicker,
    categoryPicker
) {
    const formData = new FormData(targetForm);
    const isCustomCategory =
        categoryPicker.categorySelect.value === OUTRA_CATEGORIA;
    const location = locationPicker.obterCoordenadas();

    return {
        titulo: formData.get("titulo").trim(),
        descricao: formData.get("descricao").trim(),
        categoria: isCustomCategory
            ? categoryPicker.customCategoryInput.value.trim()
            : categoryPicker.categorySelect.value,
        categoriaPersonalizada: isCustomCategory,
        endereco: formData.get("endereco").trim(),
        latitude: location?.latitude ?? Number.NaN,
        longitude: location?.longitude ?? Number.NaN
    };
}

function formatarData(dataCriacao) {
    const data = new Date(dataCriacao);

    return Number.isNaN(data.getTime())
        ? "Data não disponível"
        : new Intl.DateTimeFormat("pt-BR", {
            dateStyle: "medium",
            timeStyle: "short"
        }).format(data);
}

function criarTexto(tagName, className, text) {
    const element = document.createElement(tagName);

    element.className = className;
    element.textContent = text;

    return element;
}

function criarDetalhe(label, value) {
    const detail = document.createElement("div");
    const labelElement = document.createElement("strong");

    labelElement.textContent = `${label}: `;

    detail.append(
        labelElement,
        document.createTextNode(value)
    );

    return detail;
}

function renderizarOcorrencias() {
    occurrencesList.replaceChildren();

    if (!ocorrenciasAtuais.length) {
        occurrencesList.append(
            criarTexto(
                "p",
                "empty-state",
                "Ainda não há ocorrências cadastradas."
            )
        );
        return;
    }

    for (const ocorrencia of ocorrenciasAtuais) {
        const card = document.createElement("article");
        card.className = "occurrence-card";

        const top = document.createElement("div");
        top.className = "occurrence-card__top";

        top.append(
            criarTexto("h3", "", ocorrencia.titulo),
            criarTexto("span", "badge", ocorrencia.status)
        );

        const description = criarTexto(
            "p",
            "occurrence-card__description",
            ocorrencia.descricao
        );

        const details = document.createElement("div");
        details.className = "occurrence-card__details";

        details.append(
            criarDetalhe("Categoria", ocorrencia.categoria),
            criarDetalhe("Endereço", ocorrencia.endereco),
            criarDetalhe(
                "Criada em",
                formatarData(ocorrencia.dataCriacao)
            )
        );

        const actions = document.createElement("div");
        actions.className = "occurrence-card__actions";

        const editButton = criarTexto(
            "button",
            "button button--secondary",
            "Editar"
        );

        editButton.type = "button";
        editButton.dataset.action = "edit";
        editButton.dataset.id = ocorrencia.id;

        editButton.setAttribute(
            "aria-label",
            `Editar ocorrência: ${ocorrencia.titulo}`
        );

        const deleteButton = criarTexto(
            "button",
            "button button--danger",
            "Excluir"
        );

        deleteButton.type = "button";
        deleteButton.dataset.action = "delete";
        deleteButton.dataset.id = ocorrencia.id;

        deleteButton.setAttribute(
            "aria-label",
            `Excluir ocorrência: ${ocorrencia.titulo}`
        );

        actions.append(editButton, deleteButton);
        card.append(top, description, details, actions);
        occurrencesList.append(card);
    }
}

function agendarCarregamentoArea(delay = 300) {
    versaoConsulta += 1;

    window.clearTimeout(temporizadorRecarregar);

    temporizadorRecarregar = window.setTimeout(() => {
        temporizadorRecarregar = null;

        if (requisicaoEmAndamento) {
            recarregarPendente = true;
            return;
        }

        void carregarOcorrenciasDaVisualizacao(versaoConsulta);
    }, delay);
}

async function recarregarOcorrenciasDaVisualizacao() {
    versaoConsulta += 1;

    window.clearTimeout(temporizadorRecarregar);
    temporizadorRecarregar = null;

    await carregarOcorrenciasDaVisualizacao(versaoConsulta);
}

async function carregarOcorrenciasDaVisualizacao(
    versaoDestaConsulta
) {
    if (!mapaPrincipal) {
        return;
    }

    if (requisicaoEmAndamento) {
        recarregarPendente = true;
        return;
    }

    const modoDestaConsulta = modoVisualizacao;
    const centroDestaConsulta = centroBuscaProxima;

    // Guarda o raio desta consulta para manter a requisição
    // e a mensagem consistentes mesmo se o usuário mudar o seletor.
    const raioDestaConsulta = obterRaioBuscaMetros();

    const bounds = modoDestaConsulta === "area"
        ? mapaPrincipal.getBounds()
        : null;

    const limites = bounds
        ? {
            minLatitude: bounds.getSouth(),
            minLongitude: bounds.getWest(),
            maxLatitude: bounds.getNorth(),
            maxLongitude: bounds.getEast()
        }
        : null;

    requisicaoEmAndamento = true;
    refreshButton.disabled = true;

    showMessage(
        mainMapMessage,
        modoDestaConsulta === "proximas"
            ? `Buscando ocorrências em até ${formatarRaio(raioDestaConsulta)}...`
            : "Carregando ocorrências desta área..."
    );

    try {
        const ocorrencias = modoDestaConsulta === "proximas"
            ? await listarOcorrenciasProximas(
                centroDestaConsulta.latitude,
                centroDestaConsulta.longitude,
                raioDestaConsulta
            )
            : await listarOcorrenciasPorArea(limites);

        if (!Array.isArray(ocorrencias)) {
            throw new Error(
                "A resposta da API não está no formato esperado."
            );
        }

        if (
            versaoDestaConsulta !== versaoConsulta
            || modoDestaConsulta !== modoVisualizacao
        ) {
            recarregarPendente = true;
            return;
        }

        ocorrenciasAtuais = ocorrencias;

        renderizarOcorrencias();
        renderizarMarcadores();

        showMessage(listMessage, "");
    } catch (error) {
        if (versaoDestaConsulta === versaoConsulta) {
            showMessage(
                mainMapMessage,
                error.message,
                "error"
            );
        }

        showMessage(
            listMessage,
            error.message,
            "error"
        );
    } finally {
        requisicaoEmAndamento = false;
        refreshButton.disabled = false;

        if (recarregarPendente) {
            recarregarPendente = false;

            void carregarOcorrenciasDaVisualizacao(
                versaoConsulta
            );
        }
    }
}

function abrirEdicao(id) {
    const ocorrencia = ocorrenciasAtuais.find(
        (item) => String(item.id) === String(id)
    );

    if (!ocorrencia) {
        showMessage(
            listMessage,
            "Não foi possível localizar essa ocorrência na lista.",
            "error"
        );
        return;
    }

    ocorrenciaEmEdicaoId = ocorrencia.id;

    editForm.elements.namedItem("titulo").value =
        ocorrencia.titulo;

    editForm.elements.namedItem("descricao").value =
        ocorrencia.descricao;

    const isCustomCategory = !categorias.has(
        ocorrencia.categoria
    );

    editCategory.categorySelect.value = isCustomCategory
        ? OUTRA_CATEGORIA
        : ocorrencia.categoria;

    editCategory.customCategoryInput.value = isCustomCategory
        ? ocorrencia.categoria
        : "";

    editCategory.atualizarVisibilidade();

    editForm.elements.namedItem("endereco").value =
        ocorrencia.endereco;

    showMessage(editMessage, "");

    editDialog.showModal();

    if (
        !editLocation.initialize([
            ocorrencia.latitude,
            ocorrencia.longitude
        ])
    ) {
        showMessage(
            editMessage,
            "Não foi possível carregar o mapa de edição.",
            "error"
        );
    }
}

function fecharEdicao() {
    if (editDialog.open) {
        editDialog.close();
    }

    ocorrenciaEmEdicaoId = null;
    editForm.reset();
    editCategory.atualizarVisibilidade();
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!form.reportValidity()) {
        return;
    }

    const ocorrencia = obterDadosFormulario(
        form,
        createLocation,
        createCategory
    );

    const validationMessage = validarFormulario(ocorrencia);

    if (validationMessage) {
        showMessage(
            formMessage,
            validationMessage,
            "error"
        );
        return;
    }

    submitButton.disabled = true;

    showMessage(
        formMessage,
        "Cadastrando ocorrência..."
    );

    let criada;

    try {
        criada = await cadastrarOcorrencia(ocorrencia);
    } catch (error) {
        showMessage(
            formMessage,
            error.message,
            "error"
        );

        submitButton.disabled = false;
        return;
    }

    submitButton.disabled = false;

    form.reset();
    createCategory.atualizarVisibilidade();
    createLocation.limpar();

    form.querySelector(
        "[data-geocode-results]"
    ).replaceChildren();

    showMessage(
        formMessage,
        "Ocorrência cadastrada com sucesso.",
        "success"
    );

    focarMapaNaOcorrencia(criada, ocorrencia);

    await recarregarOcorrenciasDaVisualizacao();
});

editForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!editForm.reportValidity()) {
        return;
    }

    const dados = obterDadosFormulario(
        editForm,
        editLocation,
        editCategory
    );

    const validationMessage = validarFormulario(dados);

    if (validationMessage) {
        showMessage(
            editMessage,
            validationMessage,
            "error"
        );
        return;
    }

    saveEditButton.disabled = true;
    closeEditButton.disabled = true;
    cancelEditButton.disabled = true;

    showMessage(
        editMessage,
        "Salvando alterações..."
    );

    try {
        const idEmEdicao = ocorrenciaEmEdicaoId;

        const atualizada = await atualizarOcorrencia(
            idEmEdicao,
            dados
        );

        ocorrenciasAtuais = ocorrenciasAtuais.map(
            (ocorrencia) =>
                String(ocorrencia.id) === String(atualizada.id)
                    ? atualizada
                    : ocorrencia
        );

        renderizarOcorrencias();

        await recarregarOcorrenciasDaVisualizacao();

        fecharEdicao();

        showMessage(
            listMessage,
            "Ocorrência atualizada com sucesso.",
            "success"
        );
    } catch (error) {
        showMessage(
            editMessage,
            error.message,
            "error"
        );
    } finally {
        saveEditButton.disabled = false;
        closeEditButton.disabled = false;
        cancelEditButton.disabled = false;
    }
});

occurrencesList.addEventListener("click", async (event) => {
    const button = event.target.closest(
        "button[data-action]"
    );

    if (!button) {
        return;
    }

    const { action, id } = button.dataset;

    if (action === "edit") {
        abrirEdicao(id);
        return;
    }

    if (action !== "delete") {
        return;
    }

    const ocorrencia = ocorrenciasAtuais.find(
        (item) => String(item.id) === String(id)
    );

    if (
        !ocorrencia
        || !window.confirm(
            `Deseja excluir a ocorrência "${ocorrencia.titulo}"?`
        )
    ) {
        return;
    }

    button.disabled = true;

    try {
        await excluirOcorrencia(id);

        ocorrenciasAtuais = ocorrenciasAtuais.filter(
            (item) => String(item.id) !== String(id)
        );

        renderizarOcorrencias();

        await recarregarOcorrenciasDaVisualizacao();

        showMessage(
            listMessage,
            "Ocorrência excluída com sucesso.",
            "success"
        );
    } catch (error) {
        button.disabled = false;

        showMessage(
            listMessage,
            error.message,
            "error"
        );
    }
});

closeEditButton.addEventListener("click", fecharEdicao);
cancelEditButton.addEventListener("click", fecharEdicao);

editDialog.addEventListener("click", (event) => {
    if (
        event.target === editDialog
        && !saveEditButton.disabled
    ) {
        fecharEdicao();
    }
});

editDialog.addEventListener("cancel", (event) => {
    if (saveEditButton.disabled) {
        event.preventDefault();
    }
});

editDialog.addEventListener("close", () => {
    ocorrenciaEmEdicaoId = null;
    editForm.reset();
    editCategory.atualizarVisibilidade();
});

mainMapLocationButton.addEventListener(
    "click",
    solicitarLocalizacaoPrincipal
);

nearbySearchButton.addEventListener(
    "click",
    mostrarOcorrenciasProximas
);

returnAreaButton.addEventListener(
    "click",
    voltarParaAreaVisivel
);

refreshButton.addEventListener("click", () => {
    if (modoVisualizacao === "proximas") {
        void recarregarOcorrenciasDaVisualizacao();
    } else {
        agendarCarregamentoArea(0);
    }
});

// Quando o raio mudar, atualiza o círculo e refaz a consulta.
radiusSelect.addEventListener("change", () => {
    if (
        modoVisualizacao === "proximas"
        && centroBuscaProxima
    ) {
        atualizarCamadaBuscaProxima();

        void recarregarOcorrenciasDaVisualizacao();
    }
});

inicializarMapaPrincipal();
