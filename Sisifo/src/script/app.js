// Estado global da aplicacao
const state = {
  sources: [],
  selectedGroups: [],
  statusFilter: "todos",
  classificationFilter: "todas",
  query: "",
};

// Rotulos apresentados no badge de status
const statusLabels = {
  "em-uso": "Em uso",
  "casual": "Casualmente",
  "aguardando": "Andamento",
  "em-analise": "Para analise",
  "descartado": "Descartado",
};

// Referencias dos elementos principais do DOM
const selectedGroupsContainer = document.querySelector("#selected-groups");
const ratingsGrid = document.querySelector("#ratings-grid");
const sourcesTableBody = document.querySelector("#sources-table-body");
const emptyState = document.querySelector("#sources-empty");
const searchInput = document.querySelector("#search-input");
const filterButtons = Array.from(document.querySelectorAll(".filter-pill"));
const runtimeStamp = Date.now();

initialize();

// Inicializa dados, eventos e renderizacao inicial
async function initialize() {
  try {
    const [sources, selectedGroups] = await Promise.all([
      fetchJson(`data/sources.json?v=${runtimeStamp}`),
      fetchJson(`data/selected-groups.json?v=${runtimeStamp}`),
    ]);

    state.sources = normalizeSources(sources);
    state.selectedGroups = normalizeSelectedGroups(selectedGroups);

    bindEvents();
    renderPage();
  } catch (error) {
    renderErrorState(error);
  }
}

// Carrega um arquivo JSON
async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Falha ao carregar ${path}`);
  }

  return response.json();
}

// Normaliza a lista completa de fontes
function normalizeSources(sources) {
  if (!Array.isArray(sources)) {
    return [];
  }

  return sources.map((item) => ({
    id: item.id || slugify(item.name || ""),
    name: item.name || "Sem nome",
    category: normalizeCategory(item.category),
    description: item.description || "",
    motivation: item.motivation || "",
    status: item.status || "aguardando",
    url: item.url || "#",
    order: Number.isFinite(item.order) ? item.order : 999,
  }));
}

// Normaliza os metadados de grupos selecionados (sem items)
function normalizeSelectedGroups(groups) {
  if (!Array.isArray(groups)) {
    return [];
  }

  return groups
    .map((group) => ({
      title: group.title || "Grupo",
      description: group.description || "",
      categoryKey: group.categoryKey || slugify(group.title || "grupo"),
      order: Number.isFinite(group.order) ? group.order : 999,
    }))
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "pt-BR"));
}

// Normaliza categoria e remove marcadores legados
function normalizeCategory(value) {
  const normalized = String(value || "").trim();
  return normalized === "<REMOVER>" ? "" : normalized;
}

// Liga interacoes de filtro e busca
function bindEvents() {
  searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderSources();
  });

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const filterType = button.dataset.filterType || "status";
      const filterValue = button.dataset.filterValue || "todos";

      if (filterType === "classification") {
        state.classificationFilter = filterValue;
      } else {
        state.statusFilter = filterValue;
      }

      filterButtons
        .filter((item) => (item.dataset.filterType || "status") === filterType)
        .forEach((item) => {
          item.classList.toggle("is-active", item === button);
        });

      renderSources();
    });
  });
}

// Renderiza todas as secoes da pagina
function renderPage() {
  renderSelectedGroups();
  renderRatings();
  renderSources();
}

// Renderiza a secao de sites selecionados
function renderSelectedGroups() {
  selectedGroupsContainer.innerHTML = state.selectedGroups
    .map((group) => {
      const items = getSelectedSourcesByGroup(group.categoryKey);

      const rows = items
        .map(
          (item) => `
            <tr>
              <td data-label="Site">
                <p class="cell-title">${escapeHtml(item.name)}</p>
              </td>
              <td data-label="Observacao">${escapeHtml(item.description)}</td>
              <td data-label="Status">${createStatusBadge(item.status)}</td>
              <td data-label="Link">${createLink(item.url)}</td>
            </tr>
          `,
        )
        .join("");

      return `
        <article class="group-card">
          <section class="subgroup">
            <header class="subgroup__header">
              <h3 class="subgroup__title">${escapeHtml(group.title)}</h3>
              <p class="subgroup__description">${escapeHtml(group.description)}</p>
            </header>
            <table class="data-table">
              <thead>
                <tr>
                  <th scope="col">Site</th>
                  <th scope="col">Observacao</th>
                  <th scope="col">Status</th>
                  <th scope="col">Link</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </section>
        </article>
      `;
    })
    .join("");
}

// Retorna fontes selecionadas de um grupo em ordem manual
function getSelectedSourcesByGroup(categoryKey) {
  return state.sources
    .filter((item) => isSourceSelected(item) && item.category === categoryKey)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "pt-BR"));
}

// Renderiza os blocos de classificacao positiva e negativa
function renderRatings() {
  const groupedRatings = {
    positivo: state.sources.filter((item) => getSourceClassification(item) === "positivo"),
    negativo: state.sources.filter((item) => getSourceClassification(item) === "negativo"),
  };

  ratingsGrid.innerHTML = Object.entries(groupedRatings)
    .map(([classification, items]) => {
      const title = classification === "positivo" ? "Positivo" : "Negativo";
      const rows = items
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
        .map(
          (item) => `
            <tr>
              <td data-label="Site">
                <p class="cell-title">${escapeHtml(item.name)}</p>
              </td>
              <td data-label="Motivo">${escapeHtml(item.motivation || "Sem motivacao registrada.")}</td>
              <td data-label="Avaliacao">${createClassificationBadge(item)}</td>
              <td data-label="Status">${createStatusBadge(item.status)}</td>
            </tr>
          `,
        )
        .join("");

      return `
        <article class="rating-card" data-classification="${classification}">
          <h3 class="rating-card__title">
            <span class="rating-dot" aria-hidden="true"></span>
            ${title}
          </h3>
          <table class="data-table">
            <thead>
              <tr>
                <th scope="col">Site</th>
                <th scope="col">Motivo</th>
                <th scope="col">Avaliacao</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </article>
      `;
    })
    .join("");
}

// Renderiza a lista completa de fontes com filtros ativos
function renderSources() {
  const visibleItems = getFilteredSources();

  sourcesTableBody.innerHTML = visibleItems
    .map(
      (item) => `
        <tr>
          <td data-label="Site">
            <p class="cell-title">${escapeHtml(item.name)}</p>
          </td>
          <td data-label="Observacao">${escapeHtml(item.description)}</td>
          <td data-label="Classificacao">${createClassificationBadge(item)}</td>
          <td data-label="Status">${createStatusBadge(item.status)}</td>
          <td data-label="Link">${createLink(item.url)}</td>
        </tr>
      `,
    )
    .join("");

  emptyState.hidden = visibleItems.length > 0;
}

// Aplica busca textual + filtros e retorna em ordem alfabetica
function getFilteredSources() {
  return state.sources
    .filter((item) => {
      const matchesStatus = state.statusFilter === "todos" || item.status === state.statusFilter;
      const matchesClassification =
        state.classificationFilter === "todas" || getSourceClassification(item) === state.classificationFilter;
      const haystack = `${item.name}`.toLowerCase();
      const matchesQuery = state.query === "" || haystack.includes(state.query);
      return matchesStatus && matchesClassification && matchesQuery;
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

// Exibe estado de erro de carregamento
function renderErrorState(error) {
  const message = error instanceof Error ? error.message : "Erro desconhecido";

  selectedGroupsContainer.innerHTML = `
    <p class="empty-state">Nao foi possivel carregar os dados. ${escapeHtml(message)}</p>
  `;
  ratingsGrid.innerHTML = "";
  sourcesTableBody.innerHTML = "";
  emptyState.hidden = false;
  emptyState.textContent = "Verifique se a aplicacao esta sendo aberta por um servidor HTTP.";
}

// Gera badge de status com estilo dedicado
function createStatusBadge(status) {
  const label = statusLabels[status] || status;
  return `<span class="status-badge" data-status="${escapeHtml(status)}">${escapeHtml(label)}</span>`;
}

// Gera badge de classificacao positivo/negativo
function createClassificationBadge(source) {
  const classification = getSourceClassification(source);
  const label = classification === "positivo" ? "Positivo" : "Negativo";
  return `<span class="classification-badge" data-classification="${classification}">${label}</span>`;
}

// Fonte com categoria e considerada selecionada e positiva
function isSourceSelected(source) {
  return source.category !== "";
}

// Classificacao e derivada da presenca de categoria
function getSourceClassification(source) {
  return isSourceSelected(source) ? "positivo" : "negativo";
}

// Gera link externo para a fonte
function createLink(url) {
  return `<a class="link-text" href="${escapeAttribute(url)}" target="_blank" rel="noreferrer" aria-label="Abrir link externo" title="Abrir link externo">&#8599;</a>`;
}

// Normaliza textos em slugs para comparacoes consistentes
function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Escapa texto para HTML seguro
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Escapa atributos HTML
function escapeAttribute(value) {
  return escapeHtml(value);
}
