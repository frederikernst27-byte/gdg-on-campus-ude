import { loadAll, CHAPTER_URL } from "../lib/gdg.js";
import { fmt, timeRange, venue, isUpcoming, safeUrl } from "../lib/format.js";

// Same data flow as version 1: snapshot first, then live data from gdg.community.dev.

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};
const icon = (id) => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = `<use href="#${id}"/>`;
  return svg;
};
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const PAST_PREVIEW = 6;
const state = { data: null, source: null, showAllPast: false };

const longDate = (e) => fmt(e.start_date, e.timezone, { locale: "en-US", month: "short", day: "numeric", year: "numeric" });

// ---------- rendering ----------

function renderNext(upcoming) {
  const card = $("#next-card");
  const next = upcoming[0];
  const media = $(".next-media", card);
  const cta = $("#next-cta");
  media.classList.remove("skeleton");
  media.replaceChildren();

  if (next) {
    $("#next-pill").textContent = "Next Event";
    $("#next-title").textContent = next.title;
    $("#next-desc").textContent = next.description_short;
    $("#next-meta").replaceChildren(
      el("li", {}, icon("i-calendar"), longDate(next)),
      el("li", {}, icon("i-clock"), timeRange(next)),
      el("li", {}, icon("i-pin"), venue(next))
    );
    if (next.picture) media.append(el("img", { src: next.picture, alt: "", width: 500, height: 500 }));
    cta.href = safeUrl(next.url);
    cta.replaceChildren("Register for Event ", icon("i-arrow"));
  } else {
    $("#next-pill").textContent = "Coming soon";
    $("#next-title").textContent = "The next event is in the making";
    $("#next-desc").textContent = "As soon as the team publishes a new event on gdg.community.dev, it shows up here automatically.";
    $("#next-meta").replaceChildren();
    media.append(el("img", { src: "../assets/campus-cafeteria.jpg", alt: "", width: 900, height: 506 }));
    cta.href = safeUrl(state.data.chapter.url);
    cta.replaceChildren("Join to get notified ", icon("i-arrow"));
  }
  cta.hidden = false;
  card.setAttribute("aria-busy", "false");

  // Any further upcoming events: small links under the card, never repeated elsewhere.
  const rest = upcoming.slice(1, 4);
  $("#also").hidden = rest.length === 0;
  $("#also-list").replaceChildren(
    ...rest.map((e) =>
      el("li", {}, el("a", { href: safeUrl(e.url), target: "_blank", rel: "noopener" }, el("span", { className: "also-date", textContent: longDate(e) }), e.title))
    )
  );
}

function pastCard(e) {
  const a = el("a", { className: "past-card", href: safeUrl(e.url), target: "_blank", rel: "noopener" });
  const media = el("div", { className: "past-media" });
  if (e.picture) media.append(el("img", { src: e.picture, alt: "", loading: "lazy", width: 500, height: 500 }));
  a.append(
    media,
    el(
      "div",
      { className: "past-body" },
      el("span", { className: "past-date", textContent: longDate(e) }),
      el("h3", { textContent: e.title }),
      el("span", { className: "past-venue" }, icon("i-pin"), venue(e))
    )
  );
  return el("li", { className: "reveal" }, a);
}

function renderPast(past) {
  const items = state.showAllPast ? past : past.slice(0, PAST_PREVIEW);
  $("#past-list").replaceChildren(...items.map(pastCard));
  const more = $("#past-more");
  more.hidden = state.showAllPast || past.length <= PAST_PREVIEW;
  more.textContent = `Show all ${past.length} past events`;
}

function renderTeam(team) {
  $("#team-list").replaceChildren(
    ...team.map((m) =>
      el(
        "li",
        { className: "reveal" },
        el(
          "a",
          { className: "member", href: safeUrl(m.profile_url), target: "_blank", rel: "noopener" },
          el("img", { src: m.avatar, alt: "", loading: "lazy", width: 72, height: 72 }),
          el("span", {}, el("strong", { textContent: m.name }), el("span", { textContent: m.role }))
        )
      )
    )
  );
}

function render() {
  const { events, team, chapter, updated_at } = state.data;
  const upcoming = events.filter((e) => isUpcoming(e));
  const past = events.filter((e) => !isUpcoming(e)).reverse();

  renderNext(upcoming);
  renderPast(past);
  renderTeam(team);

  // Middle community photo: the latest event picture
  const photo = $("#photo-event");
  const latest = past.find((e) => e.picture);
  if (latest) Object.assign(photo, { src: latest.picture, alt: latest.title });

  if (chapter.members_count) $('[data-stat="members"]').textContent = chapter.members_count;
  document.querySelectorAll("[data-join]").forEach((a) => {
    a.href = safeUrl(chapter.url);
    a.target = "_blank";
    a.rel = "noopener";
  });

  const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(updated_at));
  $("#sync-info").textContent = state.source === "live" ? `Events synced live from gdg.community.dev · ${when}.` : `Events snapshot from ${when}.`;

  observeReveals();
}

// ---------- motion ----------

let io;
function observeReveals() {
  const els = document.querySelectorAll(".reveal:not(.is-visible)");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    els.forEach((n) => n.classList.add("is-visible"));
    return;
  }
  io ??= new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const i = [...entry.target.parentElement.children].indexOf(entry.target);
        entry.target.style.transitionDelay = `${Math.min(i, 5) * 60}ms`;
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      }),
    { rootMargin: "0px 0px -40px 0px" }
  );
  els.forEach((n) => io.observe(n));
}

// ---------- UI wiring ----------

function wireMenu() {
  const btn = $(".menu-toggle");
  const nav = $("#main-nav");
  const setOpen = (open) => {
    btn.setAttribute("aria-expanded", String(open));
    btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    $("use", btn).setAttribute("href", open ? "#i-close" : "#i-menu");
    nav.classList.toggle("is-open", open);
  };
  btn.addEventListener("click", () => setOpen(btn.getAttribute("aria-expanded") !== "true"));
  nav.addEventListener("click", (ev) => ev.target.closest("a") && setOpen(false));
  document.addEventListener("keydown", (ev) => ev.key === "Escape" && setOpen(false));
}

async function boot() {
  $("#year").textContent = new Date().getFullYear();
  document.querySelectorAll("[data-join]").forEach((a) => Object.assign(a, { href: CHAPTER_URL, target: "_blank", rel: "noopener" }));
  wireMenu();
  $("#past-more").addEventListener("click", () => {
    state.showAllPast = true;
    renderPast(state.data.events.filter((e) => !isUpcoming(e)).reverse());
    observeReveals();
  });
  observeReveals();

  const snapshot = fetch("../data/gdg.json")
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((data) => {
      if (state.source !== "live") {
        Object.assign(state, { data, source: "snapshot" });
        render();
      }
    })
    .catch(() => {});

  try {
    const data = await loadAll({ signal: AbortSignal.timeout(10000) });
    Object.assign(state, { data, source: "live" });
    render();
  } catch (err) {
    console.warn("Live GDG data unavailable, using snapshot:", err);
    await snapshot;
    if (!state.data) {
      $("#next-title").textContent = "Events could not be loaded right now";
      $("#next-desc").replaceChildren(el("a", { href: CHAPTER_URL, target: "_blank", rel: "noopener", textContent: "See them on gdg.community.dev" }));
    }
  }
}

boot();
