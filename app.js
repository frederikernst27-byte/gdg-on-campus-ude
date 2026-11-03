import { loadAll, CHAPTER_URL } from "./lib/gdg.js";

// Data flow: paint the bundled snapshot (data/gdg.json) right away, then fetch
// live data from gdg.community.dev and re-render. New events published there
// show up on the next page load without touching this site.

const $ = (sel, root = document) => root.querySelector(sel);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const state = { data: null, source: null, filter: null };

// ---------- formatting ----------

const fmt = (iso, tz, opts) => new Intl.DateTimeFormat(opts.locale || "de-DE", { timeZone: tz, ...opts }).format(new Date(iso));

function dateParts(e) {
  return {
    month: fmt(e.start_date, e.timezone, { locale: "en-US", month: "short" }).toUpperCase(),
    day: fmt(e.start_date, e.timezone, { day: "numeric" }),
    year: fmt(e.start_date, e.timezone, { year: "numeric" }),
  };
}

function timeRange(e) {
  const t = (iso) => fmt(iso, e.timezone, { hour: "2-digit", minute: "2-digit" });
  return e.end_date ? `${t(e.start_date)} – ${t(e.end_date)}` : t(e.start_date);
}

function venue(e) {
  if (e.is_virtual || e.audience_type === "VIRTUAL") return "Online";
  const raw = e.venue_name || "";
  const atUde = /university of duisburg[- ]essen|\bude\b/i.test(raw);
  const room = raw.replace(/^room\s+/i, "").replace(/\s+at\s+university of duisburg[- ]essen/i, "").trim();
  if (atUde || /^S[A-Z]-?\d|^R\d/i.test(room)) return `UDE, ${room}`;
  return [room, e.venue_city].filter(Boolean).join(", ") || e.venue_city || "Essen";
}

const isUpcoming = (e, now = Date.now()) => Date.parse(e.end_date || e.start_date) >= now;
const safeUrl = (u) => (/^https:\/\//.test(u || "") ? u : CHAPTER_URL);

// ---------- rendering ----------

function eventCard(e, { past = false, label } = {}) {
  const node = $("#tpl-event-card").content.firstElementChild.cloneNode(true);
  const { month, day, year } = dateParts(e);
  const link = $(".event-card-link", node);
  link.href = safeUrl(e.url);
  link.setAttribute("aria-label", `${e.title} – ${day}. ${month} ${year}${past ? " (vergangen)" : ""}`);
  $(".date-month", node).textContent = month;
  $(".date-day", node).textContent = day;
  $(".event-title", node).textContent = e.title;
  $(".event-desc", node).textContent = e.description_short;
  $(".event-time", node).textContent = timeRange(e);
  $(".event-venue", node).textContent = venue(e);
  const img = $(".event-media img", node);
  if (e.picture) img.src = e.picture;
  else $(".event-media", node).remove();
  if (past) {
    node.classList.add("is-past");
    const badge = document.createElement("span");
    badge.className = "past-badge";
    badge.textContent = label || year;
    $(".date-badge", node).append(badge);
  }
  return node;
}

function renderNext(events) {
  const list = $("#next-events-list");
  const notice = $("#next-notice");
  const upcoming = events.filter((e) => isUpcoming(e));
  const past = events.filter((e) => !isUpcoming(e)).reverse();

  // Always show three cards: upcoming first, topped up with the latest past ones.
  const shown = upcoming.slice(0, 3);
  list.replaceChildren(
    ...shown.map((e) => eventCard(e)),
    ...past.slice(0, 3 - shown.length).map((e) => eventCard(e, { past: true, label: "Vorbei" }))
  );

  notice.hidden = upcoming.length > 0;
  if (!upcoming.length) {
    notice.replaceChildren(
      "Gerade sind keine neuen Events geplant – das nächste erscheint hier automatisch. Bis dahin: unsere letzten Events. ",
      Object.assign(document.createElement("a"), { href: safeUrl(state.data.chapter.url), target: "_blank", rel: "noopener", textContent: "Mitglied werden & benachrichtigt bleiben" })
    );
  }
  list.setAttribute("aria-busy", "false");
}

function renderAll(events) {
  const upcoming = events.filter((e) => isUpcoming(e));
  const past = events.filter((e) => !isUpcoming(e)).reverse();
  $('[data-count="upcoming"]').textContent = upcoming.length;
  $('[data-count="past"]').textContent = past.length;

  if (!state.filter) state.filter = upcoming.length ? "upcoming" : "past";
  document.querySelectorAll(".tab").forEach((tab) => {
    const active = tab.dataset.filter === state.filter;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    if (active) $("#events-list").setAttribute("aria-labelledby", tab.id);
  });

  const list = $("#events-list");
  list.replaceChildren();
  const items = state.filter === "upcoming" ? upcoming : past;
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `<svg class="icon icon-xl" aria-hidden="true"><use href="#i-calendar"/></svg><p><strong>Noch keine neuen Events angekündigt.</strong><br>Sobald das Team ein Event auf gdg.community.dev veröffentlicht, erscheint es hier automatisch.</p>`;
    list.append(empty);
  } else {
    items.forEach((e) => list.append(eventCard(e, { past: state.filter === "past" })));
  }
}

function renderGallery(events) {
  const gallery = $("#gallery");
  const pics = events.filter((e) => e.picture && !isUpcoming(e)).reverse().slice(0, 4);
  gallery.replaceChildren(
    ...pics.map((e) => {
      const a = document.createElement("a");
      a.className = "gallery-item reveal";
      a.href = safeUrl(e.url);
      a.target = "_blank";
      a.rel = "noopener";
      const img = Object.assign(document.createElement("img"), { src: e.picture, alt: e.title, loading: "lazy", width: 500, height: 500 });
      const cap = Object.assign(document.createElement("span"), { className: "gallery-cap", textContent: e.title });
      a.append(img, cap);
      return a;
    })
  );
}

function renderTeam(team) {
  const list = $("#team-list");
  list.replaceChildren(
    ...team.map((m) => {
      const li = document.createElement("li");
      li.className = "team-card reveal";
      const a = Object.assign(document.createElement("a"), { href: safeUrl(m.profile_url), target: "_blank", rel: "noopener" });
      const img = Object.assign(document.createElement("img"), { src: m.avatar, alt: "", loading: "lazy", width: 96, height: 96 });
      const name = Object.assign(document.createElement("strong"), { textContent: m.name });
      const role = Object.assign(document.createElement("span"), { textContent: m.role });
      a.append(img, name, role);
      li.append(a);
      return li;
    })
  );
}

function render() {
  const { data, source } = state;
  const { events, team, chapter } = data;
  renderNext(events);
  renderAll(events);
  renderGallery(events);
  renderTeam(team);

  if (chapter.members_count) $('[data-stat="members"]').textContent = chapter.members_count;
  $('[data-stat="events"]').textContent = events.length;

  const when = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.updated_at));
  $("#sync-info").textContent =
    source === "live" ? `Live synchronisiert mit gdg.community.dev · ${when}` : `Gespeicherter Stand vom ${when} · Live-Daten werden geladen …`;

  observeReveals();
}

// ---------- motion ----------

let io;
function observeReveals() {
  const els = document.querySelectorAll(".reveal:not(.is-visible)");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  io ??= new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const siblings = [...entry.target.parentElement.children];
        entry.target.style.transitionDelay = `${Math.min(siblings.indexOf(entry.target), 5) * 60}ms`;
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      }),
    { rootMargin: "0px 0px -40px 0px" }
  );
  els.forEach((el) => io.observe(el));
}

// ---------- UI wiring ----------

function wireTabs() {
  const tabs = [...document.querySelectorAll(".tab")];
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => {
      state.filter = tab.dataset.filter;
      renderAll(state.data.events);
      observeReveals();
    });
    tab.addEventListener("keydown", (ev) => {
      if (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft") return;
      const next = tabs[(i + (ev.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
      next.focus();
      next.click();
    });
  });
}

function wireMenu() {
  const btn = $(".menu-toggle");
  const nav = $("#main-nav");
  const setOpen = (open) => {
    btn.setAttribute("aria-expanded", String(open));
    btn.setAttribute("aria-label", open ? "Menü schließen" : "Menü öffnen");
    $("use", btn).setAttribute("href", open ? "#i-close" : "#i-menu");
    nav.classList.toggle("is-open", open);
  };
  btn.addEventListener("click", () => setOpen(btn.getAttribute("aria-expanded") !== "true"));
  nav.addEventListener("click", (ev) => ev.target.closest("a") && setOpen(false));
  document.addEventListener("keydown", (ev) => ev.key === "Escape" && setOpen(false));
}

// ---------- boot ----------

async function boot() {
  $("#year").textContent = new Date().getFullYear();
  wireTabs();
  wireMenu();

  const snapshot = fetch("data/gdg.json")
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((data) => {
      if (state.source !== "live") Object.assign(state, { data, source: "snapshot" }), render();
    })
    .catch(() => {});

  try {
    const data = await loadAll({ signal: AbortSignal.timeout(10000) });
    Object.assign(state, { data, source: "live" });
    render();
  } catch (err) {
    console.warn("Live GDG data unavailable, using snapshot:", err);
    await snapshot;
    if (state.data) {
      $("#sync-info").textContent = $("#sync-info").textContent.replace(" · Live-Daten werden geladen …", " · gdg.community.dev gerade nicht erreichbar");
    } else {
      $("#next-events-list").innerHTML = `<p class="notice">Events konnten gerade nicht geladen werden. <a href="${CHAPTER_URL}" target="_blank" rel="noopener">Direkt auf gdg.community.dev ansehen</a></p>`;
    }
  }
}

boot();
