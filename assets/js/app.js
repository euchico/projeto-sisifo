const state = {
  sources: [],
  selectedGroups: [],
  ratings: [],
  filter: "todos",
  query: "",
};

const statusLabels = {
  "em-uso": "Em uso",
  aguardando: "Andamento",
  "em-analise": "Para analise",
  descartado: "Descartado",
};

const selectedGroupsContainer = document.querySelector("#selected-groups");
const ratingsGrid = document.querySelector("#ratings-grid");
const sourcesTableBody = document.querySelector("#sources-table-body");
const emptyState = document.querySelector("#sources-empty");
const searchInput = document.querySelector("#search-input");
const filterButtons = Array.from(document.querySelectorAll(".filter-pill"));

initialize();

async function initialize() {
  try {
    const [sources, selectedGroups, ratings] = await Promise.all([
      fetchJson("assets/data/sources.json"),
      fetchJson("assets/data/selected-groups.json"),
      fetchJson("assets/data/ratings.json"),
    ]);

    state.sources = normalizeSources(sources);
    state.selectedGroups = normalizeSelectedGroups(selectedGroups, state.sources);
    state.ratings = normalizeRatings(ratings);

    bindEvents();
    renderPage();
  } catch (error) {
    renderErrorState(error);
  }
}

async function fetchJson(path) {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Falha ao carregar ${path}`);
  }

  return response.json();
}

function normalizeSources(sources) {
  if (!Array.isArray(sources)) {
    return [];
  }

  return sources.map((item) => ({
    id: item.id || slugify(item.name || ""),
    name: item.name || "Sem nome",
    category: item.category || "Sem categoria",
    type: item.type || "Fonte",
    description: item.description || "",
    status: item.status || "aguardando",
    url: item.url || "#",
    classification: item.classification || "Neutro",
  }));
}

function normalizeSelectedGroups(groups, sources) {
  if (!Array.isArray(groups)) {
    return [];
  }

  const sourceMap = new Map(sources.map((item) => [item.id, item]));

  return groups.map((group) => {
    const items = Array.isArray(group.items)
      ? group.items
          .map((entry) => {
            if (entry.sourceId && sourceMap.has(entry.sourceId)) {
              const source = sourceMap.get(entry.sourceId);
              return {
                ...source,
                note: entry.note || source.description,
                subtext: entry.subtext || source.type,
              };
            }

            return {
              id: entry.id || slugify(entry.name || ""),
              name: entry.name || "Sem nome",
              category: entry.category || group.title || "Sem categoria",
              type: entry.type || "Fonte",
              description: entry.description || "",
              status: entry.status || "aguardando",
              url: entry.url || "#",
              note: entry.note || entry.description || "",
              subtext: entry.subtext || entry.type || "",
            };
          })
          .filter(Boolean)
      : [];

    return {
      title: group.title || "Grupo",
      description: group.description || "",
      categoryKey: group.categoryKey || slugify(group.title || "grupo"),
      items,
    };
  });
}

function normalizeRatings(ratings) {
  if (!Array.isArray(ratings)) {
    return [];
  }

  return ratings.map((item) => ({
    name: item.name || "Sem nome",
    category: item.category || "Sem categoria",
    reason: item.reason || "",
    score: item.score || "Regular",
    sentiment: item.sentiment === "negativo" ? "negativo" : "positivo",
  }));
}

function bindEvents() {
  searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderSources();
  });

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter || "todos";

      filterButtons.forEach((item) => {
        item.classList.toggle("is-active", item === button);
      });

      renderSources();
    });
  });
}

function renderPage() {
  renderSelectedGroups();
  renderRatings();
  renderSources();
}

function renderSelectedGroups() {
  selectedGroupsContainer.innerHTML = state.selectedGroups
    .map((group) => {
      const rows = group.items
        .map(
          (item) => `
            <tr>
              <td data-label="Site">
                <p class="cell-title">${escapeHtml(item.name)}</p>
                ${item.subtext ? `<span class="table-subtext">${escapeHtml(item.subtext)}</span>` : ""}
              </td>
              <td data-label="Categoria">${escapeHtml(item.category)}</td>
              <td data-label="Observacao">${escapeHtml(item.note || item.description)}</td>
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
                  <th scope="col">Categoria</th>
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

function renderRatings() {
  const groupedRatings = {
    positivo: state.ratings.filter((item) => item.sentiment === "positivo"),
    negativo: state.ratings.filter((item) => item.sentiment === "negativo"),
  };

  ratingsGrid.innerHTML = Object.entries(groupedRatings)
    .map(([sentiment, items]) => {
      const title = sentiment === "positivo" ? "Positivo" : "Negativo";
      const rows = items
        .map(
          (item) => `
            <tr>
              <td data-label="Site">
                <p class="cell-title">${escapeHtml(item.name)}</p>
              </td>
              <td data-label="Categoria">${escapeHtml(item.category)}</td>
              <td data-label="Motivo">${escapeHtml(item.reason)}</td>
              <td data-label="Avaliacao"><span class="rating-score">${escapeHtml(item.score)}</span></td>
            </tr>
          `,
        )
        .join("");

      return `
        <article class="rating-card" data-sentiment="${sentiment}">
          <h3 class="rating-card__title">
            <span class="rating-dot" aria-hidden="true"></span>
            ${title}
          </h3>
          <table class="data-table">
            <thead>
              <tr>
                <th scope="col">Site</th>
                <th scope="col">Categoria</th>
                <th scope="col">Motivo</th>
                <th scope="col">Avaliacao</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </article>
      `;
    })
    .join("");
}

function renderSources() {
  const visibleItems = getFilteredSources();

  sourcesTableBody.innerHTML = visibleItems
    .map(
      (item) => `
        <tr>
          <td data-label="Site">
            <p class="cell-title">${escapeHtml(item.name)}</p>
            <span class="table-subtext">${escapeHtml(item.type)}</span>
          </td>
          <td data-label="Categoria">${escapeHtml(item.category)}</td>
          <td data-label="Observacao">${escapeHtml(item.description)}</td>
          <td data-label="Classificacao">${escapeHtml(item.classification)}</td>
          <td data-label="Status">${createStatusBadge(item.status)}</td>
          <td data-label="Link">${createLink(item.url)}</td>
        </tr>
      `,
    )
    .join("");

  emptyState.hidden = visibleItems.length > 0;
}

function getFilteredSources() {
  return state.sources.filter((item) => {
    const matchesStatus = state.filter === "todos" || item.status === state.filter;
    const haystack = `${item.name} ${item.category}`.toLowerCase();
    const matchesQuery = state.query === "" || haystack.includes(state.query);
    return matchesStatus && matchesQuery;
  });
}

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

function createStatusBadge(status) {
  const label = statusLabels[status] || status;
  return `<span class="status-badge" data-status="${escapeHtml(status)}">${escapeHtml(label)}</span>`;
}

function createLink(url) {
  return `<a class="link-text" href="${escapeAttribute(url)}" target="_blank" rel="noreferrer">Abrir</a>`;
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
