/* ============================================================
   OSINT Atlas — application
   ============================================================ */

(() => {
  "use strict";

  const PAGE_SIZE = 60;
  const FAV_KEY = "osint-atlas-favorites-v1";
  const THEME_KEY = "osint-atlas-theme";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const CAT_MAP = new Map(CATEGORIES.map((c, i) => [c.id, { ...c, index: i }]));
  const norm = (s) =>
    String(s)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[ch]));

  const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, "-");

  /* ---------- Données ---------- */

  const TOOLS = RAW_TOOLS.map(([name, url, cat, desc, tags, price]) => {
    const category = CAT_MAP.get(cat);
    const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
    let domain = "";
    try { domain = new URL(url).hostname.replace(/^www\./, ""); } catch { domain = ""; }
    return {
      name,
      url,
      cat,
      desc,
      tags: tagList,
      price,
      domain,
      catName: category ? category.name : cat,
      color: category ? category.color : "#6ee7f9",
      search: norm([name, desc, tagList.join(" "), category ? category.name : cat, price].join(" ")),
      nName: norm(name),
      nTags: norm(tagList.join(" ")),
      nDesc: norm(desc),
      nCat: norm(category ? category.name : cat)
    };
  });

  const BY_URL = new Map(TOOLS.map((t) => [t.url, t]));

  /* ---------- État ---------- */

  const storedFavs = (() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.filter((u) => BY_URL.has(u)) : [];
    } catch { return []; }
  })();

  const state = {
    q: "",
    cat: "all",
    price: "all",
    favOnly: false,
    sort: "default",
    page: 1,
    rendered: 0,
    terms: [],
    favs: new Set(storedFavs)
  };

  /* ---------- DOM ---------- */

  const els = {
    search: $("#search"),
    clearSearch: $("#clearSearch"),
    grid: $("#grid"),
    empty: $("#empty"),
    loadMore: $("#loadMore"),
    resultCount: $("#resultCount"),
    categoryList: $("#categoryList"),
    resetCats: $("#resetCats"),
    priceFilter: $("#priceFilter"),
    sortSelect: $("#sortSelect"),
    favFilter: $("#favFilter"),
    favCount: $("#favCount"),
    favIcon: $("#favIcon"),
    activeFilters: $("#activeFilters"),
    resetAll: $("#resetAll"),
    randomBtn: $("#randomBtn"),
    themeBtn: $("#themeBtn"),
    themeIcon: $("#themeIcon"),
    toast: $("#toast"),
    statTools: $("#statTools"),
    statCats: $("#statCats"),
    statFree: $("#statFree"),
    footCount: $("#footCount")
  };

  /* ---------- Utilitaires ---------- */

  let toastTimer = 0;
  function toast(message) {
    els.toast.innerHTML = message;
    els.toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => els.toast.classList.remove("show"), 2400);
  }

  function saveFavs() {
    try { localStorage.setItem(FAV_KEY, JSON.stringify([...state.favs])); } catch { /* stockage indisponible */ }
  }

  function initials(name) {
    const cleaned = name.replace(/[^\p{L}\p{N}\s]/gu, " ").trim();
    const stop = new Set(["de", "des", "du", "la", "le", "les", "the", "of", "and", "pour", "sur"]);
    const words = cleaned.split(/\s+/).filter((w) => w && !stop.has(w.toLowerCase()));
    if (!words.length) return "?";
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  function priceClass(price) {
    const p = norm(price);
    if (p === "gratuit") return "gratuit";
    if (p === "libre") return "libre";
    if (p === "freemium") return "freemium";
    if (p === "payant") return "payant";
    return "";
  }

  function filteredTools() {
    const q = state.q;
    const terms = q ? norm(q).split(/\s+/).filter(Boolean) : [];
    state.terms = terms;

    let list = TOOLS.filter((t) => {
      if (state.cat !== "all" && t.cat !== state.cat) return false;
      if (state.price !== "all" && t.price !== state.price) return false;
      if (state.favOnly && !state.favs.has(t.url)) return false;
      if (terms.length) {
        for (const term of terms) {
          if (!t.search.includes(term)) return false;
        }
      }
      return true;
    });

    if (terms.length) {
      for (const t of list) {
        let score = 0;
        for (const term of terms) {
          if (t.nName === term) score += 100;
          else if (t.nName.startsWith(term)) score += 55;
          else if (t.nName.includes(term)) score += 35;
          if (t.nTags.includes(term)) score += 16;
          if (t.nCat.includes(term)) score += 10;
          if (t.nDesc.includes(term)) score += 6;
        }
        t._score = score;
      }
    }

    switch (state.sort) {
      case "az":
        list.sort((a, b) => a.name.localeCompare(b.name, "fr"));
        break;
      case "za":
        list.sort((a, b) => b.name.localeCompare(a.name, "fr"));
        break;
      case "cat":
        list.sort((a, b) => (CAT_MAP.get(a.cat).index - CAT_MAP.get(b.cat).index) || a.name.localeCompare(b.name, "fr"));
        break;
      default:
        if (terms.length) list.sort((a, b) => (b._score - a._score) || a.name.localeCompare(b.name, "fr"));
        break;
    }

    return list;
  }

  /* ---------- Rendu des cartes ---------- */

  function cardHTML(t) {
    const fav = state.favs.has(t.url);
    return `
      <article class="card" style="--cat:${t.color}">
        <div class="card-top">
          <span class="card-icon" aria-hidden="true">${initials(t.name)}</span>
          <button class="star-btn${fav ? " active" : ""}" type="button"
                  data-star="${esc(t.url)}"
                  aria-pressed="${fav}"
                  aria-label="${fav ? "Retirer" : "Ajouter"} ${esc(t.name)} ${fav ? "des" : "aux"} favoris"
                  title="${fav ? "Retirer des favoris" : "Ajouter aux favoris"}">${fav ? "★" : "☆"}</button>
        </div>
        <h3><a href="${esc(t.url)}" target="_blank" rel="noopener noreferrer">${esc(t.name)}</a></h3>
        <p class="card-desc">${esc(t.desc)}</p>
        <div class="card-chips">
          <span class="chip cat">${esc(t.catName)}</span>
          <span class="chip price ${priceClass(t.price)}">${esc(t.price)}</span>
        </div>
        <div class="card-foot">
          <span class="card-domain" title="${esc(t.domain)}">${esc(t.domain)}</span>
          <button class="copy-btn" type="button" data-copy="${esc(t.url)}" title="Copier le lien">⧉ Copier</button>
        </div>
      </article>`;
  }

  function renderGrid(reset = true) {
    const list = filteredTools();

    if (reset) {
      els.grid.innerHTML = "";
      state.page = 1;
      state.rendered = 0;
    }

    const visible = list.slice(0, state.page * PAGE_SIZE);
    const fresh = visible.slice(state.rendered);
    if (fresh.length) els.grid.insertAdjacentHTML("beforeend", fresh.map(cardHTML).join(""));
    state.rendered = visible.length;

    const n = list.length;
    const total = TOOLS.length;
    let text;
    if (state.terms.length) {
      text = `${n} résultat${n > 1 ? "s" : ""} pour « ${state.q.trim()} »`;
    } else {
      text = `${n} outil${n > 1 ? "s" : ""}`;
    }
    if (n !== total && !state.terms.length) text += ` sur ${total}`;
    if (state.favOnly) text += " dans vos favoris";
    els.resultCount.textContent = text;

    els.empty.hidden = n !== 0;
    els.loadMore.hidden = visible.length >= n;
    if (!els.loadMore.hidden) {
      const rest = n - visible.length;
      els.loadMore.textContent = `Charger ${Math.min(PAGE_SIZE, rest)} outil${Math.min(PAGE_SIZE, rest) > 1 ? "s" : ""} de plus (${rest} restant${rest > 1 ? "s" : ""})`;
    }

    renderActiveFilters();
  }

  function renderCategories() {
    const counts = TOOLS.reduce((acc, t) => {
      acc[t.cat] = (acc[t.cat] || 0) + 1;
      return acc;
    }, {});

    els.categoryList.innerHTML = CATEGORIES.map((c) => `
      <button class="cat-btn${state.cat === c.id ? " active" : ""}" type="button"
              data-cat="${c.id}" style="--cat:${c.color}"
              aria-pressed="${state.cat === c.id}" title="${esc(c.name)}">
        <span class="dot" aria-hidden="true"></span>
        <span class="name">${esc(c.name)}</span>
        <span class="count">${counts[c.id] || 0}</span>
      </button>`).join("");
  }

  function renderActiveFilters() {
    const chips = [];
    if (state.terms.length) {
      chips.push(`<span class="filter-chip">Recherche : « ${esc(state.q.trim())} »<button type="button" data-clear="q" aria-label="Effacer la recherche">✕</button></span>`);
    }
    if (state.cat !== "all") {
      const c = CAT_MAP.get(state.cat);
      chips.push(`<span class="filter-chip" style="border-color:${c.color}55">${esc(c.name)}<button type="button" data-clear="cat" aria-label="Retirer le filtre de catégorie">✕</button></span>`);
    }
    if (state.price !== "all") {
      chips.push(`<span class="filter-chip">${esc(state.price)}<button type="button" data-clear="price" aria-label="Retirer le filtre d’accès">✕</button></span>`);
    }
    if (state.favOnly) {
      chips.push(`<span class="filter-chip">★ Favoris<button type="button" data-clear="fav" aria-label="Afficher tous les outils">✕</button></span>`);
    }
    els.activeFilters.hidden = chips.length === 0;
    els.activeFilters.innerHTML = chips.join("");
  }

  function syncFavoriteUI() {
    els.favCount.textContent = state.favs.size;
    els.favFilter.classList.toggle("active", state.favOnly);
    els.favFilter.setAttribute("aria-pressed", String(state.favOnly));
    els.favIcon.textContent = state.favOnly ? "★" : "☆";
    els.favFilter.title = state.favOnly ? "Afficher tous les outils" : "Afficher uniquement mes favoris";
  }

  function renderAll(reset = true) {
    renderCategories();
    syncFavoriteUI();
    renderGrid(reset);
  }

  /* ---------- Actions ---------- */

  function clearFilter(name) {
    if (name === "q") {
      state.q = "";
      els.search.value = "";
      els.clearSearch.hidden = true;
    } else if (name === "cat") {
      state.cat = "all";
    } else if (name === "price") {
      state.price = "all";
      els.priceFilter.value = "all";
    } else if (name === "fav") {
      state.favOnly = false;
    }
    renderAll(true);
  }

  function resetEverything() {
    state.q = "";
    state.cat = "all";
    state.price = "all";
    state.favOnly = false;
    state.sort = "default";
    els.search.value = "";
    els.clearSearch.hidden = true;
    els.priceFilter.value = "all";
    els.sortSelect.value = "default";
    renderAll(true);
    els.search.focus();
  }

  function toggleFavorite(url) {
    const tool = BY_URL.get(url);
    if (!tool) return;
    const wasFav = state.favs.has(url);
    if (wasFav) state.favs.delete(url);
    else state.favs.add(url);
    saveFavs();
    syncFavoriteUI();

    const btn = els.grid.querySelector(`.star-btn[data-star="${CSS.escape(url)}"]`);
    if (btn) {
      btn.classList.toggle("active", !wasFav);
      btn.textContent = wasFav ? "☆" : "★";
      btn.setAttribute("aria-pressed", String(!wasFav));
      btn.setAttribute("aria-label", `${wasFav ? "Ajouter" : "Retirer"} ${tool.name} ${wasFav ? "aux" : "des"} favoris`);
      btn.title = wasFav ? "Ajouter aux favoris" : "Retirer des favoris";
    }

    if (state.favOnly && wasFav) {
      renderGrid(true);
    } else {
      renderActiveFilters();
    }

    toast(wasFav ? `Retiré des favoris : <strong>${esc(tool.name)}</strong>` : `Ajouté aux favoris : <strong>${esc(tool.name)}</strong>`);
  }

  async function copyLink(url) {
    try {
      await navigator.clipboard.writeText(url);
      toast("Lien copié dans le presse-papiers.");
    } catch {
      const area = document.createElement("textarea");
      area.value = url;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand("copy");
        toast("Lien copié dans le presse-papiers.");
      } catch {
        toast("Copie impossible — sélectionnez le lien manuellement.");
      }
      area.remove();
    }
  }

  function randomTool() {
    const pool = filteredTools();
    const source = pool.length ? pool : TOOLS;
    const tool = source[Math.floor(Math.random() * source.length)];
    window.open(tool.url, "_blank", "noopener,noreferrer");
    toast(`Découverte : <strong>${esc(tool.name)}</strong> — ${esc(tool.catName)}`);
  }

  /* ---------- Thème ---------- */

  function applyTheme(theme) {
    const t = theme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = t;
    els.themeIcon.textContent = t === "dark" ? "☀" : "☾";
    els.themeBtn.title = t === "dark" ? "Passer en thème clair" : "Passer en thème sombre";
    els.themeBtn.setAttribute("aria-label", els.themeBtn.title);
  }

  let theme = "dark";
  try { theme = localStorage.getItem(THEME_KEY) || "dark"; } catch { theme = "dark"; }
  applyTheme(theme);

  /* ---------- Écouteurs ---------- */

  let searchTimer = 0;
  els.search.addEventListener("input", () => {
    const value = els.search.value;
    els.clearSearch.hidden = value.length === 0;
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      state.q = value;
      renderGrid(true);
    }, 130);
  });

  els.clearSearch.addEventListener("click", () => {
    els.search.value = "";
    els.clearSearch.hidden = true;
    state.q = "";
    renderGrid(true);
    els.search.focus();
  });

  els.categoryList.addEventListener("click", (e) => {
    const btn = e.target.closest(".cat-btn");
    if (!btn) return;
    state.cat = state.cat === btn.dataset.cat ? "all" : btn.dataset.cat;
    renderAll(true);
  });

  els.resetCats.addEventListener("click", () => {
    state.cat = "all";
    renderAll(true);
  });

  els.priceFilter.addEventListener("change", () => {
    state.price = els.priceFilter.value;
    renderGrid(true);
  });

  els.sortSelect.addEventListener("change", () => {
    state.sort = els.sortSelect.value;
    renderGrid(true);
  });

  els.favFilter.addEventListener("click", () => {
    state.favOnly = !state.favOnly;
    renderAll(true);
  });

  els.activeFilters.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-clear]");
    if (btn) clearFilter(btn.dataset.clear);
  });

  els.grid.addEventListener("click", (e) => {
    const star = e.target.closest(".star-btn");
    if (star) {
      e.preventDefault();
      toggleFavorite(star.dataset.star);
      return;
    }
    const copy = e.target.closest(".copy-btn");
    if (copy) {
      e.preventDefault();
      copyLink(copy.dataset.copy);
    }
  });

  els.loadMore.addEventListener("click", () => {
    state.page += 1;
    renderGrid(false);
  });

  els.resetAll.addEventListener("click", resetEverything);
  els.randomBtn.addEventListener("click", randomTool);

  els.themeBtn.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
  });

  document.addEventListener("keydown", (e) => {
    const el = document.activeElement;
    const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");

    if (e.key === "/" && !typing) {
      e.preventDefault();
      els.search.focus();
      els.search.select();
      return;
    }

    if (e.key === "Escape" && el === els.search) {
      if (els.search.value) {
        els.search.value = "";
        els.clearSearch.hidden = true;
        state.q = "";
        renderGrid(true);
      } else {
        els.search.blur();
      }
    }
  });

  /* ---------- Initialisation ---------- */

  els.statTools.textContent = TOOLS.length;
  els.statCats.textContent = CATEGORIES.length;
  const freeCount = TOOLS.filter((t) => t.price === "Gratuit" || t.price === "Libre").length;
  els.statFree.textContent = freeCount;
  els.footCount.textContent = `${TOOLS.length} outils · ${CATEGORIES.length} catégories`;

  renderAll(true);
})();
