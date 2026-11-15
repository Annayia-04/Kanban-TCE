/* ============================================================
   Flowboard — application front (vanilla ES modules)
   ============================================================ */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------------------------- Icônes ---------------------------- */

const ICONS = {
  board: '<rect x="3" y="3" width="6" height="18" rx="1.6"/><rect x="11" y="3" width="6" height="11" rx="1.6"/><rect x="19" y="3" width="2" height="7" rx="1"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1.3"/><circle cx="3.5" cy="12" r="1.3"/><circle cx="3.5" cy="18" r="1.3"/>',
  file: '<path d="M14 3v5h5"/><path d="M19 8v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7z"/><path d="M9 13h6M9 17h4"/>',
  users: '<path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20"/><circle cx="9" cy="7" r="3.2"/><path d="M22 20v-1.5a4 4 0 0 0-3-3.87"/><path d="M16.5 4.2a3.2 3.2 0 0 1 0 6.2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/>',
  upload: '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  download: '<path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/>',
  check: '<path d="m4 12.5 5 5L20 6.5"/>',
  sparkles: '<path d="M12 3v4M12 17v4M5 12H3M21 12h-2M6.3 6.3 4.9 4.9M19.1 19.1l-1.4-1.4M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/><circle cx="12" cy="12" r="3"/>',
  warn: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  dots: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M3 21v-5h5"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
};

const icon = (name, cls = '') =>
  `<svg class="${cls}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

/* ---------------------------- Constantes ---------------------------- */

const STATUSES = [
  { id: 'todo', label: 'À faire', color: '#8b93a7' },
  { id: 'in_progress', label: 'En cours', color: '#2563eb' },
  { id: 'review', label: 'À review', color: '#d97706' },
  { id: 'done', label: 'Fait', color: '#16a34a' },
];
const STATUS_MAP = Object.fromEntries(STATUSES.map((s) => [s.id, s]));
const PRIORITIES = { high: 'Haute', medium: 'Moyenne', low: 'Basse' };

const state = {
  data: null,
  view: 'board',
  q: '',
  fVersion: 'all',
  fAssignee: 'all',
  theme: localStorage.getItem('fb-theme') || 'light',
  pending: null,
  openStoryId: null,
  dragId: null,
  saveTimer: null,
};

/* ---------------------------- Helpers ---------------------------- */

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const tint = (hex, alpha) => {
  let h = String(hex || '#6366f1').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

const initials = (name = '') => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const member = (id) => state.data?.members.find((m) => m.id === id) || null;
const story = (id) => state.data?.stories.find((s) => s.id === id) || null;
const version = (id) => state.data?.versions.find((v) => v.id === id) || null;

function avatarHtml(id, cls = '') {
  const m = member(id);
  if (!m) return '';
  return `<span class="avatar ${cls}" style="background:${m.color}" title="${esc(m.name)}">${esc(initials(m.name))}</span>`;
}

function avatarsHtml(ids = [], cls = '') {
  if (!ids.length) return '';
  const shown = ids.slice(0, 4).map((id) => avatarHtml(id, cls)).join('');
  const extra = ids.length > 4 ? `<span class="avatar ${cls}" style="background:var(--border-strong)">+${ids.length - 4}</span>` : '';
  return `<span class="avatars">${shown}${extra}</span>`;
}

function versionChip(v, small = false) {
  if (!v) return '';
  return `<span class="chip" style="${small ? 'height:19px;font-size:10px;' : ''}background:${tint(v.color, 0.13)};color:${v.color}">
    <span class="vdot" style="background:${v.color}"></span>${esc(v.name)}</span>`;
}

const fmtDate = (ts) =>
  new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

const fmtShort = (ts) => new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

function toast(message, type = 'ok', ms = 3200) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${icon(type === 'err' ? 'warn' : 'check')}<span>${esc(message)}</span>`;
  $('#toasts').appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .2s, transform .2s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    setTimeout(() => el.remove(), 220);
  }, ms);
}

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

/* ---------------------------- Chargement / rendu ---------------------------- */

async function load() {
  state.data = await api('/state');
  if (state.fVersion !== 'all' && !version(state.fVersion)) state.fVersion = 'all';
  if (state.fAssignee !== 'all' && !member(state.fAssignee)) state.fAssignee = 'all';
}

function render() {
  document.documentElement.dataset.theme = state.theme;
  renderSidebar();
  renderTopbar();
  renderView();
}

const ROUTES = ['board', 'backlog', 'reports', 'team'];

function go(view, { updateHash = true } = {}) {
  state.jumpTop = true;
  state.view = view;
  if (updateHash && ROUTES.includes(view)) {
    history.replaceState(null, '', `#${view}`);
  }
  render();
}

function renderSidebar() {
  const d = state.data;
  const active = (v) => (state.view === v ? 'is-active' : '');
  const nav = [
    { id: 'board', label: 'Tableau', icon: 'board', count: d.stories.filter((s) => s.status !== 'done').length },
    { id: 'backlog', label: 'Backlog', icon: 'list', count: d.stories.length },
    { id: 'reports', label: 'Comptes rendus', icon: 'file', count: d.reports.length },
    { id: 'team', label: 'Équipe', icon: 'users', count: d.members.length },
  ];
  const llm = d.meta?.llm || {};

  $('#sidebar').innerHTML = `
    <div class="brand">
      <div class="brand-mark">${icon('board').replace('fill="none" stroke="currentColor"', 'fill="none" stroke="#fff"')}</div>
      <div>
        <div class="brand-name">Flowboard</div>
        <div class="brand-sub">Kanban d’équipe</div>
      </div>
    </div>

    <button class="project-card" data-act="edit-project">
      <span class="pc-name">${esc(d.project.name)} <span style="color:var(--muted);font-weight:500">${icon('dots')}</span></span>
      <span class="pc-meta">${esc(d.project.sprint || 'Sans sprint')} · ${d.stories.length} US</span>
    </button>

    <nav class="nav">
      ${nav
        .map(
          (n) => `<button class="nav-item ${active(n.id)}" data-act="nav" data-view="${n.id}">
            ${icon(n.icon)}<span>${n.label}</span><span class="count">${n.count}</span>
          </button>`
        )
        .join('')}
    </nav>

    <div class="side-block">
      <div class="side-block-head">
        <span class="nav-label">Versions</span>
        <button class="btn btn-ghost btn-icon btn-sm" data-act="new-version" title="Nouvelle version">${icon('plus')}</button>
      </div>
      <div class="version-list">
        ${d.versions
          .map((v) => {
            const count = d.stories.filter((s) => s.versionId === v.id).length;
            return `<button class="version-item ${state.fVersion === v.id ? 'is-active' : ''}" data-act="filter-version" data-id="${v.id}">
              <span class="vdot" style="background:${v.color}"></span>
              <span>${esc(v.name)}</span>
              <span class="vcount">${count}</span>
            </button>`;
          })
          .join('')}
        ${
          d.stories.some((s) => !s.versionId)
            ? `<button class="version-item ${state.fVersion === 'none' ? 'is-active' : ''}" data-act="filter-version" data-id="none">
                <span class="vdot" style="background:var(--border-strong)"></span><span>Sans version</span>
                <span class="vcount">${d.stories.filter((s) => !s.versionId).length}</span>
              </button>`
            : ''
        }
      </div>
    </div>

    <div class="side-foot">
      ${
        d.meta?.auth?.user
          ? `<div class="side-user" title="Utilisateur authentifié via le SSO">${icon('users')}<span>${esc(d.meta.auth.user)}</span></div>`
          : ''
      }
      <button class="engine-badge" data-act="engine-info" title="Moteur d’extraction">
        <span class="dot ${llm.enabled ? 'ia' : ''}"></span>
        <span>${llm.enabled ? `IA · ${esc(llm.model || '')}` : 'Extraction locale'}</span>
      </button>
      <div class="side-actions">
        <a class="btn btn-ghost btn-sm" href="/api/export" download title="Exporter les données">${icon('download')}Export</a>
        <button class="btn btn-ghost btn-sm" data-act="import-data" title="Importer une sauvegarde">${icon('upload')}Import</button>
        <button class="btn btn-ghost btn-icon btn-sm" data-act="toggle-theme" title="Thème clair / sombre">
          ${icon(state.theme === 'dark' ? 'sun' : 'moon')}
        </button>
      </div>
      <input type="file" id="import-file" accept="application/json" class="sr-only" />
    </div>
  `;
}

function renderTopbar() {
  const d = state.data;
  $('#topbar').innerHTML = `
    <button class="btn btn-ghost btn-icon menu-btn" data-act="toggle-menu" aria-label="Menu">${icon('menu')}</button>
    <div class="search">
      ${icon('search')}
      <input class="input" id="search-input" type="search" placeholder="Rechercher une US, un tag, une personne…" value="${esc(state.q)}" />
      <kbd>/</kbd>
    </div>
    <div class="spacer"></div>
    <div class="top-filters">
      <select class="select" id="filter-version" title="Filtrer par version">
        <option value="all"${state.fVersion === 'all' ? ' selected' : ''}>Toutes versions</option>
        ${d.versions.map((v) => `<option value="${v.id}"${state.fVersion === v.id ? ' selected' : ''}>${esc(v.name)}</option>`).join('')}
        <option value="none"${state.fVersion === 'none' ? ' selected' : ''}>Sans version</option>
      </select>
      <select class="select" id="filter-assignee" title="Filtrer par personne">
        <option value="all"${state.fAssignee === 'all' ? ' selected' : ''}>Toute l’équipe</option>
        ${d.members.map((m) => `<option value="${m.id}"${state.fAssignee === m.id ? ' selected' : ''}>${esc(m.name)}</option>`).join('')}
        <option value="none"${state.fAssignee === 'none' ? ' selected' : ''}>Non assigné</option>
      </select>
    </div>
    <button class="btn" data-act="goto-reports">${icon('upload')}<span class="hide-sm">Importer un CR</span></button>
    <button class="btn btn-primary" data-act="new-story">${icon('plus')}Nouvelle US</button>
  `;

  $('#search-input').addEventListener('input', (e) => {
    state.q = e.target.value;
    renderView();
  });
  $('#search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.target.value = '';
      state.q = '';
      renderView();
      e.target.blur();
    }
  });
  $('#filter-version').addEventListener('change', (e) => {
    state.fVersion = e.target.value;
    renderView();
  });
  $('#filter-assignee').addEventListener('change', (e) => {
    state.fAssignee = e.target.value;
    renderView();
  });
}

function renderView() {
  const view = $('#view');
  const scrollLeft = $('.board', view)?.scrollLeft || 0;
  const scrollY = window.scrollY;

  if (state.view === 'board') view.innerHTML = boardHtml();
  else if (state.view === 'backlog') view.innerHTML = backlogHtml();
  else if (state.view === 'reports') view.innerHTML = reportsHtml();
  else if (state.view === 'team') view.innerHTML = teamHtml();
  else if (state.view === 'review') view.innerHTML = reviewHtml();

  const board = $('.board', view);
  if (board) board.scrollLeft = scrollLeft;
  if (state.jumpTop) {
    window.scrollTo({ top: 0 });
    state.jumpTop = false;
  } else {
    window.scrollTo({ top: scrollY });
  }
  if (state.view === 'reports') bindReports();
}

/* ---------------------------- Filtres ---------------------------- */

function hasFilters() {
  return state.q.trim() !== '' || state.fVersion !== 'all' || state.fAssignee !== 'all';
}

function filteredStories() {
  const q = state.q.trim().toLowerCase();
  return state.data.stories.filter((s) => {
    if (state.fVersion !== 'all') {
      if (state.fVersion === 'none' ? Boolean(s.versionId) : s.versionId !== state.fVersion) return false;
    }
    if (state.fAssignee !== 'all') {
      if (state.fAssignee === 'none' ? s.assigneeIds.length > 0 : !s.assigneeIds.includes(state.fAssignee)) return false;
    }
    if (q) {
      const names = s.assigneeIds.map((id) => member(id)?.name || '').join(' ');
      const hay = `${s.key} ${s.title} ${s.description} ${s.asA} ${s.iWant} ${s.soThat} ${(s.tags || []).join(' ')} ${names}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/* ---------------------------- Vue : Tableau ---------------------------- */

function cardHtml(s) {
  const v = version(s.versionId);
  return `
    <article class="card prio-${s.priority} ${s.status === 'done' ? 'done' : ''}" draggable="true" data-id="${s.id}">
      <div class="card-top">
        <span class="card-key">${esc(s.key)}</span>
        ${v ? versionChip(v, true) : ''}
      </div>
      <div class="card-title">${esc(s.title)}</div>
      ${
        s.tags?.length
          ? `<div class="card-tags">${s.tags.slice(0, 3).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>`
          : ''
      }
      <div class="card-foot">
        ${s.due ? `<span class="due">${icon('calendar')}${esc(s.due)}</span>` : ''}
        ${s.points != null ? `<span class="points" title="Points">${s.points}</span>` : ''}
        ${avatarsHtml(s.assigneeIds)}
      </div>
    </article>`;
}

function boardHtml() {
  const list = filteredStories();
  const totalPoints = list.reduce((n, s) => n + (s.points || 0), 0);
  const done = list.filter((s) => s.status === 'done').length;

  const stats = `
    <div class="stats">
      <div class="stat"><div class="k">US visibles</div><div class="v">${list.length}<small> / ${state.data.stories.length}</small></div></div>
      <div class="stat"><div class="k">En cours</div><div class="v">${list.filter((s) => s.status === 'in_progress').length}</div></div>
      <div class="stat"><div class="k">À review</div><div class="v">${list.filter((s) => s.status === 'review').length}</div></div>
      <div class="stat"><div class="k">Terminées</div><div class="v">${done}<small> ${list.length ? Math.round((done / list.length) * 100) : 0}%</small></div></div>
      <div class="stat"><div class="k">Points engagés</div><div class="v">${totalPoints}</div></div>
    </div>`;

  const columns = STATUSES.map((st) => {
    const items = list.filter((s) => s.status === st.id).sort((a, b) => a.order - b.order);
    return `
      <section class="column" data-status="${st.id}">
        <header class="column-head">
          <span class="column-dot" style="background:${st.color}"></span>
          <span class="label">${st.label}</span>
          <span class="wip">${items.length}</span>
          <button class="btn btn-ghost btn-icon btn-sm add" data-act="new-story-status" data-status="${st.id}" title="Ajouter une US">${icon('plus')}</button>
        </header>
        <div class="cards">
          ${items.length ? items.map(cardHtml).join('') : `<div class="column-empty">Dépose une carte ici</div>`}
        </div>
      </section>`;
  }).join('');

  return `
    <div class="view-head">
      <div>
        <h1>Tableau</h1>
        <div class="sub">${esc(state.data.project.name)} · glissez-déposez les cartes pour changer leur statut</div>
      </div>
      <div class="actions">
        ${hasFilters() ? `<button class="btn btn-ghost" data-act="clear-filters">${icon('close')}Effacer les filtres</button>` : ''}
      </div>
    </div>
    ${stats}
    <div class="board">${columns}</div>
  `;
}

/* ---------------------------- Vue : Backlog ---------------------------- */

function statusSelect(s, small = true) {
  return `<select class="select" data-act="row-status" data-id="${s.id}">
    ${STATUSES.map((st) => `<option value="${st.id}"${s.status === st.id ? ' selected' : ''}>${st.label}</option>`).join('')}
  </select>`;
}

function rowHtml(s) {
  return `
    <div class="trow" data-id="${s.id}">
      <span class="tkey">${esc(s.key)}</span>
      <span class="ttitle ${s.status === 'done' ? 'done' : ''}">${esc(s.title)}</span>
      <span>${versionChip(version(s.versionId), true) || '<span style="color:var(--muted);font-size:11.5px">—</span>'}</span>
      <span class="tassignees">${avatarsHtml(s.assigneeIds, 'sm') || '<span style="color:var(--muted);font-size:11.5px">—</span>'}</span>
      <span>${statusSelect(s)}</span>
      <span><span class="chip prio-${s.priority}">${PRIORITIES[s.priority]}</span></span>
      <span class="tnum">${s.points != null ? s.points : '—'}</span>
      <span class="tdate">${esc(s.due || '')}</span>
    </div>`;
}

function backlogHtml() {
  const list = filteredStories();
  const groups = [];

  const known = state.data.versions;
  for (const v of known) groups.push({ id: v.id, name: v.name, color: v.color, items: [] });
  groups.push({ id: null, name: 'Sans version', color: '#8b93a7', items: [] });

  for (const s of list) {
    const g = groups.find((x) => x.id === s.versionId) || groups[groups.length - 1];
    g.items.push(s);
  }

  const active = groups.filter((g) => g.items.length);
  const totalPts = list.reduce((n, s) => n + (s.points || 0), 0);

  return `
    <div class="view-head">
      <div>
        <h1>Backlog</h1>
        <div class="sub">${list.length} user ${list.length > 1 ? 'stories' : 'story'} · ${totalPts} points ${hasFilters() ? '· filtres actifs' : ''}</div>
      </div>
      <div class="actions">
        ${hasFilters() ? `<button class="btn btn-ghost" data-act="clear-filters">${icon('close')}Effacer les filtres</button>` : ''}
        <button class="btn btn-primary" data-act="new-story">${icon('plus')}Nouvelle US</button>
      </div>
    </div>

    ${
      active.length
        ? `<div class="backlog">${active
            .map(
              (g) => `
          <section>
            <div class="group-head">
              <span class="vdot" style="background:${g.color}"></span>
              <span class="gname">${esc(g.name)}</span>
              <span class="gcount">${g.items.length} US · ${g.items.reduce((n, s) => n + (s.points || 0), 0)} pts</span>
              <span class="gbar"></span>
            </div>
            <div class="table">
              <div class="thead">
                <span>Clé</span><span>User story</span><span>Version</span><span>Assigné</span>
                <span>Statut</span><span>Priorité</span><span>Pts</span><span>Échéance</span>
              </div>
              ${g.items
                .slice()
                .sort((a, b) => Number(a.key.replace(/\D/g, '')) - Number(b.key.replace(/\D/g, '')))
                .map(rowHtml)
                .join('')}
            </div>
          </section>`
            )
            .join('')}</div>`
        : `<div class="empty">
            <h3>Aucune user story</h3>
            <p>${hasFilters() ? "Aucune US ne correspond à ces filtres." : 'Importe un compte rendu de réunion : les user stories seront extraites et assignées automatiquement.'}</p>
            <button class="btn btn-primary" data-act="goto-reports">${icon('sparkles')}Importer un compte rendu</button>
          </div>`
    }
  `;
}

/* ---------------------------- Vue : Comptes rendus ---------------------------- */

function reportsHtml() {
  const reports = state.data.reports;
  const llm = state.data.meta?.llm || {};
  return `
    <div class="view-head">
      <div>
        <h1>Comptes rendus</h1>
        <div class="sub">Dépose un fichier ou colle le texte : les actions sont transformées en user stories assignées.</div>
      </div>
    </div>

    <div class="reports-layout">
      <div class="panel">
        <h2>Nouvelle analyse</h2>
        <div class="hint">${
          llm.enabled
            ? `Moteur IA activé (<b>${esc(llm.model || '')}</b>) — extraction sémantique.`
            : 'Moteur local : détection des verbes d’action, des personnes citées, des versions et des échéances.'
        }</div>

        <div class="dropzone" id="dropzone">
          <div class="dz-icon">${icon('upload')}</div>
          <div class="dz-title">Dépose ton compte rendu ici</div>
          <div class="dz-sub">ou clique pour parcourir tes fichiers</div>
          <div class="dz-formats"><span>.txt</span><span>.md</span><span>.docx</span><span>.odt</span><span>.pdf</span></div>
          <input type="file" id="cr-file" class="sr-only" accept=".txt,.md,.markdown,.csv,.docx,.odt,.pdf" />
        </div>

        <div class="divider">ou colle le texte</div>

        <textarea class="textarea" id="cr-text" rows="7" placeholder="Colle ici le compte rendu de réunion…&#10;&#10;Ex : « Marie doit valider les tarifs avant vendredi. Thomas va brancher le paiement en v1. »"></textarea>
        <div style="display:flex;gap:8px;margin-top:10px;align-items:center;flex-wrap:wrap">
          <button class="btn btn-primary" data-act="analyze-text">${icon('sparkles')}Analyser</button>
          <button class="btn btn-ghost" data-act="load-demo">Charger l’exemple</button>
          <span style="margin-left:auto;font-size:11.5px;color:var(--muted)">30 caractères minimum</span>
        </div>
      </div>

      <div class="panel">
        <h2>Historique</h2>
        <div class="hint">${reports.length} compte${reports.length > 1 ? 's' : ''} rendu${reports.length > 1 ? 's' : ''} analysé${reports.length > 1 ? 's' : ''}</div>
        <div class="report-list">
          ${
            reports.length
              ? reports
                  .map(
                    (r) => `
              <div class="report-row" data-act="open-report" data-id="${r.id}">
                <span class="ricon">${icon('file')}</span>
                <div style="min-width:0">
                  <div class="rname">${esc(r.name)}</div>
                  <div class="rmeta">${fmtDate(r.createdAt)} · ${r.participants.length} participant${r.participants.length > 1 ? 's' : ''} · ${r.engine === 'ia' ? 'IA' : 'local'}</div>
                </div>
                <span class="chip rcount">${r.storyIds.length} US</span>
              </div>`
                  )
                  .join('')
              : `<div class="empty" style="padding:24px"><p>Aucun compte rendu pour le moment.</p></div>`
          }
        </div>
      </div>
    </div>
  `;
}

function bindReports() {
  const dz = $('#dropzone');
  const input = $('#cr-file');
  if (!dz || !input) return;

  dz.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    if (input.files?.[0]) analyzeFile(input.files[0]);
  });
  ['dragenter', 'dragover'].forEach((ev) =>
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      dz.classList.add('over');
    })
  );
  ['dragleave', 'drop'].forEach((ev) =>
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      dz.classList.remove('over');
    })
  );
  dz.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) analyzeFile(file);
  });
}

async function analyzeFile(file) {
  const dz = $('#dropzone');
  if (dz) {
    dz.innerHTML = `<div class="dz-icon">${icon('refresh')}</div><div class="dz-title">Analyse de ${esc(file.name)}…</div><div class="dz-sub">Extraction du texte puis détection des actions</div>`;
  }
  try {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]+,/, ''));
      reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
      reader.readAsDataURL(file);
    });
    const result = await api('/analyze', { method: 'POST', body: { filename: file.name, fileBase64: base64 } });
    startReview(result);
  } catch (err) {
    toast(err.message, 'err', 6000);
    renderView();
  }
}

async function analyzeText() {
  const text = $('#cr-text')?.value || '';
  if (text.trim().length < 30) return toast('Le texte est trop court (30 caractères minimum).', 'err');
  const btn = $('[data-act="analyze-text"]');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `${icon('refresh')}Analyse…`;
  }
  try {
    const result = await api('/analyze', { method: 'POST', body: { text, filename: 'Compte rendu collé' } });
    startReview(result);
  } catch (err) {
    toast(err.message, 'err', 6000);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `${icon('sparkles')}Analyser`;
    }
  }
}

function startReview(result) {
  state.pending = {
    report: result.report,
    engine: result.engine,
    warning: result.warning,
    participants: result.participants || [],
    candidates: (result.candidates || []).map((c) => ({ ...c, selected: !c.duplicateOf })),
  };
  state.data.reports.unshift(result.report);
  state.view = 'review';
  render();
  window.scrollTo({ top: 0 });
}

/* ---------------------------- Vue : Revue ---------------------------- */

function reviewHtml() {
  const p = state.pending;
  if (!p) return `<div class="empty"><h3>Aucune analyse en cours</h3></div>`;
  const selected = p.candidates.filter((c) => c.selected).length;

  return `
    <div class="view-head">
      <div>
        <h1>Analyse du compte rendu</h1>
        <div class="sub">
          <b>${esc(p.report.name)}</b> · ${p.candidates.length} action${p.candidates.length > 1 ? 's' : ''} détectée${p.candidates.length > 1 ? 's' : ''}
          · ${p.engine === 'ia' ? 'moteur IA' : 'moteur local'}
          ${p.participants.length ? ` · ${p.participants.map((m) => esc(m.name)).join(', ')}` : ''}
        </div>
      </div>
      <div class="actions">
        <button class="btn" data-act="diagnose" data-id="${p.report.id}">${icon('search')}Diagnostic</button>
        <button class="btn" data-act="review-back">${icon('chevron')}Retour aux comptes rendus</button>
      </div>
    </div>

    ${p.warning ? `<div class="banner warn">${icon('warn')}<div>${esc(p.warning)}</div></div>` : ''}
    ${
      !p.candidates.length
        ? `<div class="banner info">${icon('info')}<div>Aucune action détectée. Le texte contient peut-être uniquement des décisions ou des informations. Tu peux ajouter les US à la main.<div style="margin-top:8px"><button class="btn btn-sm" data-act="diagnose" data-id="${p.report.id}">${icon('search')}Voir le diagnostic</button></div></div></div>`
        : `<div class="banner info">${icon('info')}<div>Vérifie et ajuste les propositions, décoche ce qui n’est pas une action, puis importe dans le backlog.</div></div>`
    }

    <div class="review-list">
      ${p.candidates.map((c, i) => candidateHtml(c, i)).join('')}
    </div>

    <div class="import-bar">
      <span class="info"><b>${selected}</b> user story${selected > 1 ? 'ies' : ''} sélectionnée${selected > 1 ? 's' : ''}</span>
      <span class="spacer"></span>
      <button class="btn btn-ghost" data-act="review-delete-report">${icon('trash')}Supprimer l’analyse</button>
      <button class="btn btn-primary" data-act="import-candidates" ${selected ? '' : 'disabled'}>
        ${icon('check')}Importer dans le backlog
      </button>
    </div>
  `;
}

function candidateHtml(c, i) {
  const conf = Math.round((c.confidence || 0) * 100);
  const confCls = conf >= 75 ? '' : conf >= 55 ? 'mid' : 'low';
  return `
    <div class="candidate ${c.selected ? '' : 'off'}" data-idx="${i}">
      <button class="check ${c.selected ? 'on' : ''}" data-act="toggle-cand" data-idx="${i}" aria-label="Sélectionner">${icon('check')}</button>
      <div>
        <div style="display:flex;gap:8px;align-items:center">
          <input class="title-in" data-cand="title" data-idx="${i}" value="${esc(c.title)}" />
          <span class="conf ${confCls}">${conf}%</span>
        </div>
        <div class="meta-row">
          <select class="select" data-cand="versionId" data-idx="${i}" title="Version">
            <option value="">Sans version</option>
            ${state.data.versions.map((v) => `<option value="${v.id}"${c.versionId === v.id ? ' selected' : ''}>${esc(v.name)}</option>`).join('')}
          </select>
          <select class="select" data-cand="priority" data-idx="${i}" title="Priorité">
            ${Object.entries(PRIORITIES).map(([id, label]) => `<option value="${id}"${c.priority === id ? ' selected' : ''}>${label}</option>`).join('')}
          </select>
          <select class="select" data-cand="status" data-idx="${i}" title="Statut">
            ${STATUSES.map((st) => `<option value="${st.id}"${(c.status || 'todo') === st.id ? ' selected' : ''}>${st.label}</option>`).join('')}
          </select>
          <span style="width:1px;height:18px;background:var(--border)"></span>
          ${state.data.members
            .map(
              (m) => `<button class="assignee-toggle ${(c.assigneeIds || []).includes(m.id) ? 'on' : ''}" data-act="toggle-cand-assignee" data-idx="${i}" data-id="${m.id}" title="${esc(m.name)}">
                <span class="avatar sm" style="background:${m.color};border-color:${(c.assigneeIds || []).includes(m.id) ? 'var(--accent-soft)' : 'var(--surface)'}">${esc(initials(m.name))}</span>
                ${esc(m.name.split(/\s+/)[0])}
              </button>`
            )
            .join('')}
        </div>
        ${c.due ? `<div style="margin-top:6px"><span class="chip">${icon('calendar')}${esc(c.due)}</span></div>` : ''}
        ${
          c.source?.excerpt
            ? `<div class="src">${c.source.line ? `Ligne ${c.source.line}${c.source.section ? ` · ${esc(c.source.section)}` : ''} — ` : ''}« ${esc(c.source.excerpt)} »</div>`
            : ''
        }
        ${c.duplicateOf ? `<div class="dup">${icon('warn')} Ressemble à ${esc(c.duplicateOf.key)} déjà dans le backlog</div>` : ''}
      </div>
      <button class="btn btn-ghost btn-icon btn-sm" data-act="drop-cand" data-idx="${i}" title="Retirer">${icon('close')}</button>
    </div>`;
}

async function importCandidates() {
  const p = state.pending;
  if (!p) return;
  const candidates = p.candidates
    .filter((c) => c.selected)
    .map(({ selected, duplicateOf, cues, assigneeNames, versionName, ...rest }) => rest);
  if (!candidates.length) return toast('Sélectionne au moins une user story.', 'err');

  const btn = $('[data-act="import-candidates"]');
  if (btn) btn.disabled = true;
  try {
    const res = await api(`/reports/${p.report.id}/import`, { method: 'POST', body: { candidates } });
    await load();
    state.pending = null;
    go('backlog');
    toast(`${res.created.length} user ${res.created.length > 1 ? 'stories ajoutées' : 'story ajoutée'} au backlog`);
  } catch (err) {
    toast(err.message, 'err', 5000);
    if (btn) btn.disabled = false;
  }
}

async function deletePendingReport() {
  const p = state.pending;
  if (!p) return;
  confirmModal('Supprimer cette analyse ?', 'Le compte rendu sera retiré de l’historique. Aucune US ne sera créée.', async () => {
    await api(`/reports/${p.report.id}`, { method: 'DELETE' });
    await load();
    state.pending = null;
    go('reports');
    toast('Analyse supprimée');
  });
}

/* ---------------------------- Vue : Équipe ---------------------------- */

function teamHtml() {
  const d = state.data;
  const cards = d.members
    .map((m) => {
      const mine = d.stories.filter((s) => s.assigneeIds.includes(m.id));
      const count = (st) => mine.filter((s) => s.status === st).length;
      return `
      <div class="member-card">
        <div class="mc-head">
          <span class="avatar lg" style="background:${m.color}">${esc(initials(m.name))}</span>
          <div style="min-width:0">
            <div class="mc-name">${esc(m.name)}</div>
            <div class="mc-role">${esc(m.role || 'Membre de l’équipe')}</div>
          </div>
          <button class="btn btn-ghost btn-icon btn-sm" style="margin-left:auto" data-act="edit-member" data-id="${m.id}" title="Modifier">${icon('dots')}</button>
        </div>
        ${m.email ? `<div class="mc-mail">${esc(m.email)}</div>` : ''}
        <div class="member-stats">
          <div><div class="n">${count('todo')}</div><div class="l">À faire</div></div>
          <div><div class="n">${count('in_progress')}</div><div class="l">En cours</div></div>
          <div><div class="n">${count('review')}</div><div class="l">Review</div></div>
          <div><div class="n">${count('done')}</div><div class="l">Fait</div></div>
        </div>
      </div>`;
    })
    .join('');

  return `
    <div class="view-head">
      <div>
        <h1>Équipe</h1>
        <div class="sub">Les noms et alias servent au moteur pour assigner les actions détectées.</div>
      </div>
      <div class="actions">
        <button class="btn btn-primary" data-act="new-member">${icon('plus')}Ajouter un membre</button>
      </div>
    </div>
    <div class="team-grid">
      ${cards}
      <button class="add-tile" data-act="new-member">${icon('plus')}Ajouter un membre</button>
    </div>
  `;
}

/* ---------------------------- Drawer (détail US) ---------------------------- */

function openStory(id) {
  const s = story(id);
  if (!s) return;
  state.openStoryId = id;
  const v = version(s.versionId);

  $('#drawer').innerHTML = `
    <div class="drawer-head">
      <span class="dk">${esc(s.key)}</span>
      <span class="chip status-${s.status}">${STATUS_MAP[s.status].label}</span>
      <span class="spacer"></span>
      <button class="btn btn-ghost btn-icon" data-act="close-drawer" title="Fermer (Échap)">${icon('close')}</button>
    </div>
    <div class="drawer-body">
      <div class="field">
        <textarea class="title-input" data-field="title" rows="1" style="min-height:52px">${esc(s.title)}</textarea>
      </div>

      <div class="field">
        <span class="field-label">User story</span>
        <div class="us-format">
          <div class="us-line"><span class="kw">En tant que</span><input class="input" data-field="asA" value="${esc(s.asA)}" placeholder="rôle / persona" /></div>
          <div class="us-line"><span class="kw">je veux</span><input class="input" data-field="iWant" value="${esc(s.iWant)}" placeholder="l’action attendue" /></div>
          <div class="us-line"><span class="kw">afin de</span><input class="input" data-field="soThat" value="${esc(s.soThat)}" placeholder="le bénéfice" /></div>
        </div>
      </div>

      <div class="field">
        <span class="field-label">Description</span>
        <textarea class="textarea" data-field="description" rows="4" placeholder="Contexte, critères d’acceptation…">${esc(s.description)}</textarea>
      </div>

      <div class="field">
        <span class="field-label">Assigné à</span>
        <div class="assignee-picker">
          ${state.data.members
            .map(
              (m) => `<button class="pick ${s.assigneeIds.includes(m.id) ? 'on' : ''}" data-act="pick-assignee" data-id="${m.id}">
                <span class="avatar sm" style="background:${m.color}">${esc(initials(m.name))}</span>${esc(m.name.split(/\s+/)[0])}
              </button>`
            )
            .join('')}
        </div>
      </div>

      <div class="meta-grid">
        <div class="field">
          <label>Statut</label>
          <select class="select" data-field="status">
            ${STATUSES.map((st) => `<option value="${st.id}"${s.status === st.id ? ' selected' : ''}>${st.label}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Version</label>
          <select class="select" data-field="versionId">
            <option value="">Sans version</option>
            ${state.data.versions.map((x) => `<option value="${x.id}"${s.versionId === x.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Priorité</label>
          <select class="select" data-field="priority">
            ${Object.entries(PRIORITIES).map(([id, label]) => `<option value="${id}"${s.priority === id ? ' selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Points</label>
          <input class="input" type="number" min="0" max="100" data-field="points" value="${s.points ?? ''}" placeholder="—" />
        </div>
        <div class="field">
          <label>Échéance</label>
          <input class="input" data-field="due" value="${esc(s.due)}" placeholder="ex : vendredi, 12/11" />
        </div>
        <div class="field">
          <label>Tags</label>
          <div class="tag-editor" id="tag-editor">
            ${s.tags
              .map(
                (t) => `<span class="tag-edit">${esc(t)}<button data-act="remove-tag" data-tag="${esc(t)}" title="Retirer">${icon('close')}</button></span>`
              )
              .join('')}
            <input class="tag-input" data-act="add-tag" placeholder="+ tag" />
          </div>
        </div>
      </div>

      ${
        s.source?.excerpt
          ? `<div class="source-box"><div class="sl">Source · ${esc(s.source.section || 'compte rendu')}${s.source.line ? `, ligne ${s.source.line}` : ''}</div>${esc(s.source.excerpt)}</div>`
          : ''
      }

      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted)">
        <span>Créée le ${fmtDate(s.createdAt)}</span>
        <button class="btn btn-ghost btn-sm btn-danger" data-act="delete-story">${icon('trash')}Supprimer</button>
      </div>
    </div>
    <div class="drawer-foot">
      ${icon('check')}<span id="save-status">Enregistré</span>
      <span style="margin-left:auto" id="drawer-version">${v ? esc(v.name) : ''}</span>
    </div>
  `;

  $('#drawer').hidden = false;
  $('#scrim').hidden = false;
  autoGrow($('.title-input', $('#drawer')));
}

function closeDrawer() {
  flushSave();
  $('#drawer').hidden = true;
  $('#scrim').hidden = true;
  $('#drawer').innerHTML = '';
  state.openStoryId = null;
}

function autoGrow(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
}

function queueSave(patch) {
  const id = state.openStoryId;
  if (!id) return;
  const s = story(id);
  if (!s) return;
  Object.assign(s, patch);
  s.updatedAt = Date.now();
  state.pendingPatch = { ...(state.pendingPatch || {}), ...patch };
  const badge = $('#save-status');
  if (badge) badge.textContent = 'Modification…';
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => {
    const payload = state.pendingPatch;
    state.pendingPatch = null;
    persistStory(id, payload || {});
  }, 450);
}

function flushSave() {
  clearTimeout(state.saveTimer);
  state.saveTimer = null;
  const id = state.openStoryId;
  const payload = state.pendingPatch;
  state.pendingPatch = null;
  if (id && payload && Object.keys(payload).length) persistStory(id, payload);
}

async function persistStory(id, patch) {
  try {
    const updated = await api(`/stories/${id}`, { method: 'PATCH', body: patch });
    const local = story(id);
    if (local) Object.assign(local, updated);
    const badge = $('#save-status');
    if (badge) badge.textContent = 'Enregistré';
    if (patch.status || patch.order != null) renderView();
  } catch (err) {
    toast(err.message, 'err');
    const badge = $('#save-status');
    if (badge) badge.textContent = 'Erreur';
  }
}

/* ---------------------------- Modales ---------------------------- */

function openModal(html) {
  $('#modal').innerHTML = html;
  $('#modal-backdrop').hidden = false;
  setTimeout(() => $('#modal input, #modal textarea')?.focus(), 40);
}

function closeModal() {
  $('#modal-backdrop').hidden = true;
  $('#modal').innerHTML = '';
}

function confirmModal(title, message, onConfirm, confirmLabel = 'Confirmer') {
  openModal(`
    <h2>${esc(title)}</h2>
    <div class="m-sub">${esc(message)}</div>
    <div class="m-actions">
      <button class="btn" data-act="modal-close">Annuler</button>
      <button class="btn btn-danger" data-act="modal-confirm">${icon('trash')}${esc(confirmLabel)}</button>
    </div>
  `);
  $('#modal [data-act="modal-confirm"]').addEventListener('click', async () => {
    closeModal();
    try {
      await onConfirm();
    } catch (err) {
      toast(err.message, 'err');
    }
  });
}

function newStoryModal(status = 'todo') {
  const v = state.data.versions[0];
  openModal(`
    <h2>Nouvelle user story</h2>
    <div class="m-sub">Une action concrète, assignable et testable.</div>
    <form class="m-fields" id="story-form">
      <div class="field">
        <label>Titre</label>
        <input class="input" name="title" placeholder="Ex : Permettre le paiement par carte" required />
      </div>
      <div class="field">
        <label>En tant que … je veux … afin de …</label>
        <div class="us-line"><span class="kw">En tant que</span><input class="input" name="asA" placeholder="un client" /></div>
        <div class="us-line" style="margin-top:6px"><span class="kw">je veux</span><input class="input" name="iWant" placeholder="payer par carte" /></div>
        <div class="us-line" style="margin-top:6px"><span class="kw">afin de</span><input class="input" name="soThat" placeholder="activer mon compte" /></div>
      </div>
      <div class="row2">
        <div class="field">
          <label>Version</label>
          <select class="select" name="versionId">
            <option value="">Sans version</option>
            ${state.data.versions.map((x) => `<option value="${x.id}"${v && x.id === v.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Statut</label>
          <select class="select" name="status">
            ${STATUSES.map((st) => `<option value="${st.id}"${st.id === status ? ' selected' : ''}>${st.label}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Priorité</label>
          <select class="select" name="priority">
            ${Object.entries(PRIORITIES).map(([id, label]) => `<option value="${id}"${id === 'medium' ? ' selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Points</label>
          <input class="input" type="number" name="points" min="0" max="100" placeholder="—" />
        </div>
      </div>
      <div class="field">
        <label>Assigné à</label>
        <div class="assignee-picker">
          ${state.data.members
            .map(
              (m) => `<button type="button" class="pick" data-pick="${m.id}">
                <span class="avatar sm" style="background:${m.color}">${esc(initials(m.name))}</span>${esc(m.name.split(/\s+/)[0])}
              </button>`
            )
            .join('')}
        </div>
      </div>
      <div class="m-actions">
        <button type="button" class="btn" data-act="modal-close">Annuler</button>
        <button class="btn btn-primary" type="submit">${icon('plus')}Créer</button>
      </div>
    </form>
  `);

  const picks = new Set();
  $$('#story-form .pick').forEach((btn) =>
    btn.addEventListener('click', () => {
      const id = btn.dataset.pick;
      if (picks.has(id)) {
        picks.delete(id);
        btn.classList.remove('on');
      } else {
        picks.add(id);
        btn.classList.add('on');
      }
    })
  );

  $('#story-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    body.assigneeIds = [...picks];
    if (!body.points) body.points = null;
    try {
      await api('/stories', { method: 'POST', body });
      await load();
      closeModal();
      render();
      toast('User story créée');
    } catch (err) {
      toast(err.message, 'err');
    }
  });
}

function memberModal(existing = null) {
  openModal(`
    <h2>${existing ? 'Modifier le membre' : 'Nouveau membre'}</h2>
    <div class="m-sub">Les alias permettent de reconnaître les surnoms dans les comptes rendus (ex : « Léa, Lea »).</div>
    <form class="m-fields" id="member-form">
      <div class="field"><label>Nom complet</label><input class="input" name="name" value="${esc(existing?.name || '')}" placeholder="Marie Lefèvre" required /></div>
      <div class="row2">
        <div class="field"><label>Rôle</label><input class="input" name="role" value="${esc(existing?.role || '')}" placeholder="Product Owner" /></div>
        <div class="field"><label>Email</label><input class="input" type="email" name="email" value="${esc(existing?.email || '')}" placeholder="marie@equipe.fr" /></div>
      </div>
      <div class="field"><label>Alias (séparés par des virgules)</label><input class="input" name="aliases" value="${esc(existing?.aliases || '')}" placeholder="Marie, ML" /></div>
      <div class="m-actions">
        ${existing ? `<button type="button" class="btn btn-ghost btn-danger" data-act="delete-member">${icon('trash')}Retirer</button>` : ''}
        <span style="flex:1"></span>
        <button type="button" class="btn" data-act="modal-close">Annuler</button>
        <button class="btn btn-primary" type="submit">${existing ? 'Enregistrer' : 'Ajouter'}</button>
      </div>
    </form>
  `);

  $('#member-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    try {
      if (existing) await api(`/members/${existing.id}`, { method: 'PATCH', body });
      else await api('/members', { method: 'POST', body });
      await load();
      closeModal();
      render();
      toast(existing ? 'Membre mis à jour' : 'Membre ajouté');
    } catch (err) {
      toast(err.message, 'err');
    }
  });

  $('[data-act="delete-member"]')?.addEventListener('click', () => {
    closeModal();
    confirmModal(
      'Retirer ce membre ?',
      'Il sera désassigné de toutes ses user stories. Les US sont conservées.',
      async () => {
        await api(`/members/${existing.id}`, { method: 'DELETE' });
        await load();
        render();
        toast('Membre retiré');
      },
      'Retirer'
    );
  });
}

function versionModal() {
  openModal(`
    <h2>Nouvelle version</h2>
    <div class="m-sub">Ex : v1, v1.1, v2, MVP… Les comptes rendus qui mentionnent « v2 » seront rattachés automatiquement.</div>
    <form class="m-fields" id="version-form">
      <div class="row2">
        <div class="field"><label>Nom</label><input class="input" name="name" placeholder="v1" required /></div>
        <div class="field"><label>Couleur</label><input class="input" type="color" name="color" value="#6366f1" style="padding:3px;height:34px" /></div>
      </div>
      <div class="field"><label>Objectif (optionnel)</label><input class="input" name="description" placeholder="Périmètre du lancement" /></div>
      <div class="m-actions">
        <button type="button" class="btn" data-act="modal-close">Annuler</button>
        <button class="btn btn-primary" type="submit">${icon('plus')}Créer</button>
      </div>
    </form>
  `);
  $('#version-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/versions', { method: 'POST', body: Object.fromEntries(new FormData(e.target).entries()) });
      await load();
      closeModal();
      render();
      toast('Version créée');
    } catch (err) {
      toast(err.message, 'err');
    }
  });
}

function projectModal() {
  const p = state.data.project;
  openModal(`
    <h2>Projet</h2>
    <div class="m-sub">Nom affiché dans la barre latérale et le tableau.</div>
    <form class="m-fields" id="project-form">
      <div class="field"><label>Nom du projet</label><input class="input" name="name" value="${esc(p.name)}" required /></div>
      <div class="row2">
        <div class="field"><label>Sprint en cours</label><input class="input" name="sprint" value="${esc(p.sprint || '')}" placeholder="Sprint 12" /></div>
        <div class="field"><label> </label><div style="font-size:11.5px;color:var(--muted);padding-top:9px">${state.data.stories.length} US · ${state.data.members.length} membres</div></div>
      </div>
      <div class="m-actions">
        <button type="button" class="btn btn-ghost btn-danger" data-act="reset-demo">${icon('refresh')}Réinitialiser la démo</button>
        <span style="flex:1"></span>
        <button type="button" class="btn" data-act="modal-close">Annuler</button>
        <button class="btn btn-primary" type="submit">Enregistrer</button>
      </div>
    </form>
  `);
  $('#project-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/project', { method: 'PATCH', body: Object.fromEntries(new FormData(e.target).entries()) });
      await load();
      closeModal();
      render();
      toast('Projet mis à jour');
    } catch (err) {
      toast(err.message, 'err');
    }
  });
  $('[data-act="reset-demo"]')?.addEventListener('click', () => {
    closeModal();
    confirmModal('Réinitialiser les données ?', 'Toutes les US, comptes rendus et membres actuels seront remplacés par la démo.', async () => {
      await api('/reset', { method: 'POST' });
      await load();
      state.fVersion = 'all';
      state.fAssignee = 'all';
      state.q = '';
      render();
      toast('Données réinitialisées');
    }, 'Réinitialiser');
  });
}

async function openDiagnostic(reportId) {
  try {
    const d = await api(`/reports/${reportId}/diagnose`);
    const kept = d.candidates.length;
    const rows = [...d.debug].sort((a, b) => Number(b.kept) - Number(a.kept) || a.line - b.line);
    const rejected = d.debug.filter((x) => !x.kept);
    const sameReason = (reason) => rejected.filter((x) => x.reason === reason).length;
    const topReasons = d.stats.filter((s) => s.reason !== 'retenues').slice(0, 4);

    openModal(`
      <h2>Diagnostic de l’analyse</h2>
      <div class="m-sub">${esc(d.reportName)} · ${d.characters.toLocaleString('fr-FR')} caractères · moteur ${d.engine === 'ia' ? 'IA' : 'local'}</div>
      <div class="diag-stats">
        <span class="diag-pill ok">${kept} retenue${kept > 1 ? 's' : ''}</span>
        <span class="diag-pill">${rejected.length} ligne${rejected.length > 1 ? 's' : ''} écartée${rejected.length > 1 ? 's' : ''}</span>
      </div>
      ${
        !kept
          ? `<div class="banner info" style="margin:10px 0">${icon('info')}<div>
              Rien n’a été retenu. Vérifie que le compte rendu contient bien des <b>actions</b> (verbe à l’infinitif, « doit… », « il faut… », « Action : … ») et non seulement des décisions ou un ordre du jour.
              Les tableaux, listes à puces, cases à cocher et le format « En tant que… je veux… » sont pris en charge.
            </div></div>`
          : ''
      }
      ${
        topReasons.length
          ? `<div class="diag-summary">${topReasons
              .map((s) => `<span class="diag-reason">${esc(s.reason)} <b>×${s.count}</b></span>`)
              .join('')}</div>`
          : ''
      }
      <div class="diag-list">
        ${rows
          .slice(0, 250)
          .map(
            (x) => `<div class="diag-row ${x.kept ? 'kept' : ''}">
              <div class="diag-line">${x.kept ? icon('check') : icon('close')} L${x.line}${x.section ? ` · ${esc(x.section)}` : ''}</div>
              <div class="diag-text">${esc(x.text || '')}</div>
              <div class="diag-why">${esc(x.kept ? 'retenue' : x.reason)}${x.score ? ` · score ${x.score}` : ''}</div>
            </div>`
          )
          .join('')}
      </div>
      <div class="m-actions">
        <button class="btn btn-primary" data-act="modal-close">Fermer</button>
      </div>
    `);
  } catch (err) {
    toast(err.message, 'err', 5000);
  }
}

function openReportModal(id) {
  const r = state.data.reports.find((x) => x.id === id);
  if (!r) return;
  openModal(`
    <h2>${esc(r.name)}</h2>
    <div class="m-sub">Ajouté le ${fmtDate(r.createdAt)} · ${r.storyIds.length} US générées · moteur ${r.engine === 'ia' ? 'IA' : 'local'}</div>
    <div class="source-box" style="max-height:44vh;overflow:auto;white-space:pre-wrap;font-family:var(--mono);font-size:11.5px">${esc(r.excerpt || '')}${
      (r.chars || 0) > 180 ? '\n\n…' : ''
    }</div>
    <div class="m-actions">
      <button class="btn btn-ghost btn-danger" data-act="report-delete">${icon('trash')}Supprimer</button>
      <span style="flex:1"></span>
      <button class="btn" data-act="modal-close">Fermer</button>
      <button class="btn" data-act="report-diagnose" data-id="${r.id}">${icon('search')}Diagnostic</button>
      <button class="btn btn-primary" data-act="rea-analyse">${icon('refresh')}Réanalyser</button>
    </div>
  `);
  $('[data-act="report-delete"]').addEventListener('click', () => {
    closeModal();
    confirmModal('Supprimer ce compte rendu ?', 'Les US déjà créées sont conservées.', async () => {
      await api(`/reports/${id}`, { method: 'DELETE' });
      await load();
      render();
      toast('Compte rendu supprimé');
    }, 'Supprimer');
  });
  $('[data-act="rea-analyse"]').addEventListener('click', async () => {
    try {
      const full = await api(`/reports/${id}`);
      closeModal();
      go('reports');
      const ta = $('#cr-text');
      if (ta) {
        ta.value = full.text;
        ta.focus();
      }
      toast('Texte chargé : clique sur « Analyser »');
    } catch (err) {
      toast(err.message, 'err');
    }
  });
}

/* ---------------------------- Déplacement des cartes ---------------------------- */

async function moveStory(id, status, index) {
  const s = story(id);
  if (!s) return;
  if (s.status === status && !hasFilters()) {
    // même colonne : réordonnancement
  }
  try {
    if (hasFilters()) {
      await api(`/stories/${id}`, { method: 'PATCH', body: { status, order: 9999 } });
      s.status = status;
    } else {
      const ids = state.data.stories
        .filter((x) => x.status === status && x.id !== id)
        .sort((a, b) => a.order - b.order)
        .map((x) => x.id);
      ids.splice(Math.max(0, Math.min(index, ids.length)), 0, id);
      await api('/stories/reorder', { method: 'POST', body: { status, ids } });
      ids.forEach((sid, i) => {
        const item = story(sid);
        if (item) {
          item.status = status;
          item.order = i;
        }
      });
    }
    renderView();
    renderSidebar();
  } catch (err) {
    toast(err.message, 'err');
    await load();
    render();
  }
}

/* ---------------------------- Abonnements globaux ---------------------------- */

function bindGlobalEvents() {
  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;

    const act = el.dataset.act;
    const id = el.dataset.id;

    switch (act) {
      case 'nav':
        $('#sidebar')?.classList.remove('open');
        go(el.dataset.view);
        break;
      case 'toggle-menu':
        $('#sidebar')?.classList.toggle('open');
        break;
      case 'toggle-theme':
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('fb-theme', state.theme);
        document.documentElement.dataset.theme = state.theme;
        renderSidebar();
        break;
      case 'filter-version':
        state.fVersion = el.dataset.id || 'all';
        go('board');
        break;
      case 'clear-filters':
        state.q = '';
        state.fVersion = 'all';
        state.fAssignee = 'all';
        render();
        break;
      case 'new-story':
        newStoryModal();
        break;
      case 'new-story-status':
        newStoryModal(el.dataset.status);
        break;
      case 'goto-reports':
        go('reports');
        break;
      case 'engine-info':
        openModal(`
          <h2>Moteur d’extraction</h2>
          <div class="m-sub">Comment les comptes rendus deviennent des user stories.</div>
          <div style="font-size:12.5px;line-height:1.65;color:var(--text-soft)">
            <p><b>Mode actuel :</b> ${
              state.data.meta?.llm?.enabled
                ? `IA via <code>${esc(state.data.meta.llm.model || '')}</code>`
                : 'analyse locale, sans réseau ni clé API'
            }</p>
            <p style="margin-top:10px"><b>Analyse locale :</b> détection des verbes d’action (français), des personnes citées (noms, alias, « X doit… », « X : … »), des versions (<code>v1</code>, <code>v2</code>, <code>MVP</code>), des échéances (<code>avant vendredi</code>, <code>12/11</code>) et de la priorité (<code>urgent</code>, <code>bloquant</code>).</p>
            <p style="margin-top:10px"><b>Activer l’IA :</b> définis <code>KANBAN_LLM_API_KEY</code> (et éventuellement <code>KANBAN_LLM_MODEL</code>, <code>KANBAN_LLM_BASE_URL</code>) puis relance le serveur. Compatible OpenAI, Ollama, LM Studio…</p>
          </div>
          <div class="m-actions"><button class="btn btn-primary" data-act="modal-close">Compris</button></div>
        `);
        break;
      case 'modal-close':
        closeModal();
        break;
      case 'close-drawer':
        closeDrawer();
        break;
      case 'edit-project':
        projectModal();
        break;
      case 'new-version':
        versionModal();
        break;
      case 'new-member':
        memberModal();
        break;
      case 'edit-member':
        memberModal(member(id));
        break;
      case 'open-report':
        openReportModal(id);
        break;
      case 'diagnose':
      case 'report-diagnose':
        openDiagnostic(id);
        break;
      case 'review-back':
        go('reports');
        break;
      case 'review-delete-report':
        deletePendingReport();
        break;
      case 'import-candidates':
        importCandidates();
        break;
      case 'toggle-cand': {
        const c = state.pending.candidates[Number(el.dataset.idx)];
        c.selected = !c.selected;
        el.classList.toggle('on', c.selected);
        el.closest('.candidate').classList.toggle('off', !c.selected);
        const bar = $('.import-bar .info');
        const n = state.pending.candidates.filter((x) => x.selected).length;
        if (bar) bar.innerHTML = `<b>${n}</b> user stor${n > 1 ? 'ies sélectionnées' : 'y sélectionnée'}`;
        const btn = $('[data-act="import-candidates"]');
        if (btn) btn.disabled = !n;
        break;
      }
      case 'toggle-cand-assignee': {
        const c = state.pending.candidates[Number(el.dataset.idx)];
        const mid = el.dataset.id;
        c.assigneeIds = c.assigneeIds || [];
        if (c.assigneeIds.includes(mid)) c.assigneeIds = c.assigneeIds.filter((x) => x !== mid);
        else c.assigneeIds.push(mid);
        el.classList.toggle('on', c.assigneeIds.includes(mid));
        break;
      }
      case 'drop-cand': {
        const i = Number(el.dataset.idx);
        state.pending.candidates.splice(i, 1);
        renderView();
        const n = state.pending.candidates.filter((x) => x.selected).length;
        const btn = $('[data-act="import-candidates"]');
        if (btn) btn.disabled = !n;
        const bar = $('.import-bar .info');
        if (bar) bar.innerHTML = `<b>${n}</b> user stor${n > 1 ? 'ies sélectionnées' : 'y sélectionnée'}`;
        break;
      }
      case 'pick-assignee': {
        const s = story(state.openStoryId);
        if (!s) break;
        if (s.assigneeIds.includes(id)) s.assigneeIds = s.assigneeIds.filter((x) => x !== id);
        else s.assigneeIds = [...s.assigneeIds, id];
        el.classList.toggle('on');
        queueSave({ assigneeIds: s.assigneeIds });
        renderView();
        break;
      }
      case 'remove-tag': {
        const s = story(state.openStoryId);
        if (!s) break;
        s.tags = s.tags.filter((t) => t !== el.dataset.tag);
        queueSave({ tags: s.tags });
        openStory(s.id);
        break;
      }
      case 'delete-story': {
        const s = story(state.openStoryId);
        if (!s) break;
        confirmModal('Supprimer cette user story ?', `${s.key} — ${s.title}`, async () => {
          await api(`/stories/${s.id}`, { method: 'DELETE' });
          closeDrawer();
          await load();
          render();
          toast('User story supprimée');
        }, 'Supprimer');
        break;
      }
      case 'row-status':
        break;
      case 'analyze-text':
        analyzeText();
        break;
      case 'load-demo':
        try {
          const demo = await api('/demo-cr');
          const ta = $('#cr-text');
          if (ta) {
            ta.value = demo.text;
            ta.focus();
          }
        } catch (err) {
          toast(err.message, 'err');
        }
        break;
      case 'import-data':
        $('#import-file')?.click();
        break;
      default:
        break;
    }
  });

  // Changements de champs
  document.addEventListener('change', async (e) => {
    const rowSelect = e.target.closest('[data-act="row-status"]');
    if (rowSelect) {
      const s = story(rowSelect.dataset.id);
      if (!s) return;
      e.stopPropagation();
      try {
        await api(`/stories/${s.id}`, { method: 'PATCH', body: { status: rowSelect.value } });
        await load();
        render();
        toast(`${s.key} déplacée vers « ${STATUS_MAP[rowSelect.value].label} »`);
      } catch (err) {
        toast(err.message, 'err');
      }
      return;
    }

    const cand = e.target.closest('[data-cand]');
    if (cand && state.pending) {
      const c = state.pending.candidates[Number(cand.dataset.idx)];
      const field = cand.dataset.cand;
      c[field] = field === 'priority' || field === 'status' || field === 'versionId' ? cand.value : cand.value;
      return;
    }

    const field = e.target.closest('#drawer [data-field]');
    if (field) {
      const name = field.dataset.field;
      const s = story(state.openStoryId);
      if (!s) return;
      let value = field.value;
      if (name === 'points') value = value === '' ? null : Number(value);
      if (name === 'versionId' && value === '') value = null;
      const patch = { [name]: value };
      queueSave(patch);
      if (['status', 'versionId', 'priority', 'points'].includes(name)) {
        renderView();
        renderSidebar();
      }
      if (name === 'status') {
        const chip = $('.drawer-head .chip');
        if (chip) {
          chip.className = `chip status-${value}`;
          chip.textContent = STATUS_MAP[value].label;
        }
      }
    }
  });

  document.addEventListener('input', (e) => {
    const candInput = e.target.closest('[data-cand="title"]');
    if (candInput && state.pending) {
      state.pending.candidates[Number(candInput.dataset.idx)].title = candInput.value;
      return;
    }
    const player = e.target.closest('.title-input');
    if (player) {
      autoGrow(player);
      queueSave({ title: player.value.trim() || 'Sans titre' });
      const cardTitle = $(`.card[data-id="${state.openStoryId}"] .card-title`);
      if (cardTitle) cardTitle.textContent = player.value.trim() || 'Sans titre';
      return;
    }
    const field = e.target.closest('#drawer [data-field]');
    if (field) {
      const name = field.dataset.field;
      if (['status', 'versionId', 'priority', 'points'].includes(name)) return;
      const s = story(state.openStoryId);
      if (!s) return;
      queueSave({ [name]: field.value });
    }
  });

  // Tags : ajout via Entrée
  document.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && e.target.matches('[data-act="add-tag"]')) {
      e.preventDefault();
      const s = story(state.openStoryId);
      if (!s) return;
      const value = e.target.value.trim();
      if (!value) return;
      if (!s.tags.includes(value)) {
        s.tags = [...s.tags, value];
        queueSave({ tags: s.tags });
        openStory(s.id);
      }
      e.target.value = '';
    }
  });

  // Ouverture d'une carte
  $('#view').addEventListener('click', (e) => {
    if (e.target.closest('select, button, input, a')) return;
    const row = e.target.closest('.trow');
    if (row) return openStory(row.dataset.id);
    const card = e.target.closest('.card');
    if (card) return openStory(card.dataset.id);
  });

  // Drag & drop
  document.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    state.dragId = card.dataset.id;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', card.dataset.id);
    } catch {
      /* ignore */
    }
  });

  document.addEventListener('dragend', () => {
    $$('.card.dragging').forEach((c) => c.classList.remove('dragging'));
    $$('.column.drag-over').forEach((c) => c.classList.remove('drag-over'));
    state.dragId = null;
  });

  document.addEventListener('dragover', (e) => {
    const col = e.target.closest('.column');
    if (!col || !state.dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    $$('.column.drag-over').forEach((c) => {
      if (c !== col) c.classList.remove('drag-over');
    });
    col.classList.add('drag-over');
  });

  document.addEventListener('dragleave', (e) => {
    const col = e.target.closest('.column');
    if (col && !col.contains(e.relatedTarget)) col.classList.remove('drag-over');
  });

  document.addEventListener('drop', (e) => {
    const col = e.target.closest('.column');
    if (!col || !state.dragId) return;
    e.preventDefault();
    col.classList.remove('drag-over');
    const cards = $$('.card:not(.dragging)', col);
    let index = cards.length;
    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i].getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) {
        index = i;
        break;
      }
    }
    const id = state.dragId;
    state.dragId = null;
    moveStory(id, col.dataset.status, index);
  });

  // Fermeture des panneaux
  $('#scrim').addEventListener('click', closeDrawer);
  $('#modal-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modal-backdrop') closeModal();
  });

  $('#view').addEventListener('click', (e) => {
    if (e.target.closest('[data-act="new-story"]')) newStoryModal();
  });

  // Import de sauvegarde
  document.addEventListener('change', async (e) => {
    if (e.target.id !== 'import-file') return;
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await api('/import', { method: 'POST', body: { data } });
      state.fVersion = 'all';
      state.fAssignee = 'all';
      state.q = '';
      await load();
      render();
      toast('Sauvegarde importée');
    } catch (err) {
      toast(`Import impossible : ${err.message}`, 'err', 5000);
    }
    e.target.value = '';
  });

  // Raccourcis clavier
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable;
    if (e.key === 'Escape') {
      if (!$('#modal-backdrop').hidden) return closeModal();
      if (!$('#drawer').hidden) return closeDrawer();
      $('#sidebar')?.classList.remove('open');
      return;
    }
    if (typing) return;
    if (e.key === '/') {
      e.preventDefault();
      $('#search-input')?.focus();
    } else if (e.key.toLowerCase() === 'n') {
      e.preventDefault();
      newStoryModal();
    } else if (e.key === '?') {
      e.preventDefault();
      openModal(`
        <h2>Raccourcis</h2>
        <div class="m-sub">Navigue plus vite.</div>
        <div style="display:grid;grid-template-columns:auto 1fr;gap:8px 14px;font-size:13px">
          <kbd>/</kbd><span>Rechercher</span>
          <kbd>N</kbd><span>Nouvelle user story</span>
          <kbd>Échap</kbd><span>Fermer un panneau</span>
        </div>
        <div class="m-actions"><button class="btn btn-primary" data-act="modal-close">Fermer</button></div>
      `);
    }
  });
}

/* ---------------------------- Démarrage ---------------------------- */

async function init() {
  bindGlobalEvents();
  try {
    await load();
    const hash = location.hash.replace('#', '');
    if (ROUTES.includes(hash)) state.view = hash;
    render();
    if (!state.data.stories.length && !state.data.reports.length && state.view === 'board') {
      go('reports');
    }
  } catch (err) {
    $('#view').innerHTML = `<div class="empty"><h3>Impossible de charger les données</h3><p>${esc(err.message)}</p><button class="btn" onclick="location.reload()">Réessayer</button></div>`;
  } finally {
    $('#boot')?.classList.add('hide');
    setTimeout(() => $('#boot')?.remove(), 400);
  }
}

init();
