(() => {
  "use strict";

  const CONFIG = window.POGO_HOME_CONFIG || {};
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const safeUrl = value => /^https:\/\//i.test(String(value || "")) ? String(value) : "";
  const MEETUP_MAP_QUERY = `query HomeMeetups($input: RealityChannelMapObjectsByS2CellsInput!) { realityChannelMapObjectsByS2Cells(input: $input) { mapObjectsByS2CellsAndTypes { mapObjectsByType { type mapObjects { id event { id location eventTime eventEndTime mapObjectLocation { latitude longitude } campfireLiveEvent { eventType id } } } } } } }`;
  const MEETUP_DETAIL_QUERY = `query HomeMeetupDetails($id: ID!) { event(id: $id) { id name address eventTime eventEndTime campfireLiveEvent { eventName eventType id } } }`;
  const localDate = value => {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  };

  $$('[data-map-link]').forEach(link => { link.href = CONFIG.mapUrl || "../map/"; });
  $$('.discord-button, a[href*="discord.gg"]').forEach(link => { link.href = CONFIG.discordUrl || "https://discord.gg/QMDWYzHccS"; });
  $("#calendarLink").href = CONFIG.meetupCalendarUrl;

  function relativeTime(target, now = Date.now()) {
    const milliseconds = target.getTime() - now;
    if (milliseconds <= 0) return "ending now";
    const minutes = Math.ceil(milliseconds / 60000);
    if (minutes < 60) return `${minutes}m left`;
    const hours = Math.ceil(minutes / 60);
    if (hours < 24) return `${hours}h left`;
    const days = Math.ceil(hours / 24);
    return `${days}d left`;
  }

  function eventBonuses(event) {
    const bonuses = [];
    const seen = new Set();
    const add = value => {
      const text = String(typeof value === "string" ? value : value?.text || value?.label || value?.description || value?.name || "")
        .replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      const key = text.toLocaleLowerCase("en");
      if (text && !seen.has(key)) { seen.add(key); bonuses.push(text); }
    };
    const walk = value => {
      if (!value || typeof value !== "object") return;
      for (const [key, item] of Object.entries(value)) {
        if (/^(bonus|bonuses)$/i.test(key)) Array.isArray(item) ? item.forEach(add) : add(item);
        else if (item && typeof item === "object") walk(item);
      }
    };
    walk(event?.extraData);
    return bonuses;
  }

  function featuredBosses(event) {
    const label = `${event.name || ""} ${event.eventType || ""} ${event.heading || ""}`;
    const isMaxBattle = /\b(max battle|max monday|gigantamax|dynamax)\b/i.test(label);
    const listed = event.extraData?.raidbattles?.bosses;
    if (Array.isArray(listed) && listed.length) return listed.map(boss => ({ name: String(boss?.name || ""), image: safeUrl(boss?.image), isMaxBattle })).filter(boss => boss.name);
    let match;
    if ((match = String(event.name || "").match(/^Gigantamax\s+(.+?)\s+Max Battle/i))) return [{ name: `Gigantamax ${match[1]}`, statsName: match[1], isMaxBattle: true }];
    if ((match = String(event.name || "").match(/^Dynamax\s+(.+?)\s+during Max Monday/i))) return [{ name: `Dynamax ${match[1]}`, statsName: match[1], isMaxBattle: true }];
    if ((match = String(event.name || "").match(/^(.+?)\s+(?:Raid Hour|(?:Super Mega )?Raid Day)$/i))) return match[1].replace(/\s*,?\s+and\s+/gi, ",").split(",").map(name => ({ name: name.trim(), isMaxBattle: false })).filter(boss => boss.name);
    return [];
  }

  function pokemonStatsForBoss(boss, data) {
    const clean = String(boss.statsName || boss.name || "").replace(/\b(Gigantamax|Dynamax|Shadow|Mega|Primal)\b/gi, "").replace(/\s+/g, " ").trim();
    const parenthesized = clean.match(/^(.+?)\s+\(([^)]+?)(?:\s+Forme?)?\)$/i);
    const prefixed = clean.match(/^(Altered|Origin|Black|White)\s+(?:Forme?\s+)?(.+)$/i);
    const species = (parenthesized?.[1] || prefixed?.[2] || clean).trim().toLocaleLowerCase("en");
    const requested = String(parenthesized?.[2] || prefixed?.[1] || "").toLocaleLowerCase("en");
    const candidates = data.filter(item => String(item.pokemon_name || "").toLocaleLowerCase("en") === species);
    return candidates.find(item => requested && String(item.form || "").toLocaleLowerCase("en").includes(requested)) || candidates.find(item => String(item.form || "").toLocaleLowerCase("en") === "normal") || candidates[0];
  }

  function pokemonCp(stats, multiplier) {
    const attack = Number(stats?.base_attack), defense = Number(stats?.base_defense), stamina = Number(stats?.base_stamina);
    return [attack, defense, stamina].every(Number.isFinite) ? Math.floor((attack + 15) * Math.sqrt(defense + 15) * Math.sqrt(stamina + 15) * multiplier * multiplier / 10) : null;
  }

  function weatherTypes(stats) {
    const weather = { Grass: "sun", Ground: "sun", Fire: "sun", Water: "rain", Electric: "rain", Bug: "rain", Normal: "partly cloudy", Rock: "partly cloudy", Fairy: "cloudy", Fighting: "cloudy", Poison: "cloudy", Flying: "wind", Dragon: "wind", Psychic: "wind", Ice: "snow", Steel: "snow", Dark: "fog", Ghost: "fog" };
    return [...new Set((stats?.type || []).map(type => weather[type]).filter(Boolean))].join(" / ");
  }

  async function loadPokemonData() {
    const [statsResponse, typesResponse] = await Promise.all([fetch(CONFIG.pokemonStatsUrl), fetch(CONFIG.pokemonTypesUrl)]);
    if (!statsResponse.ok || !typesResponse.ok) throw new Error("Pokémon data unavailable");
    const [stats, types] = await Promise.all([statsResponse.json(), typesResponse.json()]);
    const typeMap = new Map(types.map(item => [`${String(item.pokemon_name || "").toLocaleLowerCase("en")}::${String(item.form || "normal").toLocaleLowerCase("en")}`, item.type || []]));
    return stats.map(item => ({ ...item, type: typeMap.get(`${String(item.pokemon_name || "").toLocaleLowerCase("en")}::${String(item.form || "normal").toLocaleLowerCase("en")}`) || [] }));
  }

  function eventScore(event) {
    const bonuses = eventBonuses(event).length;
    const bosses = featuredBosses(event).length;
    const label = `${event.eventType || ""} ${event.name || ""}`;
    return bosses * 8 + bonuses * 3 + (/community day|raid|event|max/i.test(label) ? 2 : 0);
  }

  function renderEvents(events, pokemonData) {
    const now = Date.now();
    const active = events.filter(event => {
      const start = localDate(event.start), end = localDate(event.end);
      return start && end && start.getTime() <= now && end.getTime() > now;
    }).sort((a, b) => eventScore(b) - eventScore(a) || localDate(a.end) - localDate(b.end)).slice(0, 6);
    if (!active.length) {
      $("#activeEvents").innerHTML = '<div class="empty-state">No timed in-game event is active right now. Check back shortly for the next rotation.</div>';
      return;
    }
    $("#activeEvents").innerHTML = active.map(event => {
      const end = localDate(event.end);
      const bonuses = eventBonuses(event).slice(0, 2);
      const bosses = featuredBosses(event).slice(0, 3);
      const bossMarkup = bosses.length ? `<div class="boss-cp"><span class="boss-cp-label">Perfect catch CP · 100% IV</span><div class="boss-list">${bosses.map(boss => {
        const stats = pokemonStatsForBoss(boss, pokemonData);
        const normal = pokemonCp(stats, .59740001);
        const boosted = boss.isMaxBattle ? null : pokemonCp(stats, .667934);
        const weather = weatherTypes(stats);
        return `<div class="boss"><b>${escapeHtml(boss.name.replace(/^(Gigantamax|Dynamax)\s+/i, ""))}</b><small>${normal ? `${normal.toLocaleString()} CP${boosted ? ` · ${boosted.toLocaleString()} boosted${weather ? ` (${escapeHtml(weather)})` : ""}` : ""}` : "CP unavailable"}</small></div>`;
      }).join("")}</div></div>` : "";
      return `<article class="event-card">
        <div class="event-content"><div class="event-meta"><span class="event-type">${escapeHtml(event.eventType || "Live event")}</span><p class="event-timer" data-countdown="${escapeHtml(end.toISOString())}">${relativeTime(end)}</p></div><h3>${escapeHtml(event.name || event.heading || "Pokémon GO event")}</h3>
        ${bonuses.length ? `<ul class="bonus-list">${bonuses.map(bonus => `<li>${escapeHtml(bonus)}</li>`).join("")}</ul>` : '<ul class="bonus-list"><li>Event details are available from the source</li></ul>'}
        ${bossMarkup}<a class="event-link" href="${escapeHtml(safeUrl(event.link) || "https://leekduck.com/events/")}" target="_blank" rel="noopener">Full event details ↗</a></div>
      </article>`;
    }).join("");
  }

  function unfoldIcs(text) { return text.replace(/\r?\n[ \t]/g, ""); }
  function unescapeIcs(value) { return String(value || "").replace(/\\n/gi, " · ").replace(/\\([,;\\])/g, "$1"); }
  function parseIcsDate(value) {
    const match = String(value || "").match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
    return match ? new Date(Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5], +match[6])) : localDate(value);
  }

  function parseMeetups(text) {
    return unfoldIcs(text).split("BEGIN:VEVENT").slice(1).map(block => {
      const read = name => {
        const line = block.split(/\r?\n/).find(value => value.startsWith(`${name}:`) || value.startsWith(`${name};`));
        return line ? unescapeIcs(line.slice(line.indexOf(":") + 1)) : "";
      };
      return { name: read("SUMMARY"), start: parseIcsDate(read("DTSTART")), end: parseIcsDate(read("DTEND")), location: read("LOCATION"), url: safeUrl(read("URL")) };
    }).filter(event => event.start && (event.end || event.start).getTime() >= Date.now()).sort((a, b) => a.start - b.start);
  }

  function dateParts(date) {
    return { day: new Intl.DateTimeFormat(undefined, { day: "2-digit" }).format(date), month: new Intl.DateTimeFormat(undefined, { month: "short" }).format(date), weekday: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date), time: new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date) };
  }

  function renderMeetups(meetups) {
    if (!meetups.length) {
      $("#featuredMeetup").innerHTML = '<h3>New meetup dates coming soon.</h3><p>Join Discord to hear when the next local event is announced.</p><a href="https://discord.gg/QMDWYzHccS" target="_blank" rel="noopener">Join the community ↗</a>';
      $("#meetupStatus").textContent = "To be announced";
      $("#meetupList").innerHTML = '<div class="empty-state">No upcoming meetup has been published on Campfire yet.</div>';
      return;
    }
    const first = meetups[0], firstDate = dateParts(first.start);
    $("#meetupStatus").textContent = first.start.getTime() - Date.now() < 86400000 ? "Coming up" : `${Math.ceil((first.start.getTime() - Date.now()) / 86400000)} days away`;
    $("#featuredMeetup").innerHTML = `<h3>${escapeHtml(first.name || "Community Ambassador Meetup")}</h3><div class="featured-meta"><div><span>When</span><b>${escapeHtml(`${firstDate.weekday} ${firstDate.day} ${firstDate.month} · ${firstDate.time}`)}</b></div><div><span>Where</span><b>${escapeHtml(first.location || "Boekenbergpark")}</b></div></div>${first.url ? `<a href="${escapeHtml(first.url)}" target="_blank" rel="noopener">View meetup on Campfire ↗</a>` : ""}`;
    $("#meetupList").innerHTML = meetups.slice(0, 5).map(event => {
      const date = dateParts(event.start);
      return `<article class="meetup-row"><div class="meetup-date"><b>${escapeHtml(date.day)}</b><span>${escapeHtml(date.month)}</span></div><div class="meetup-info"><h3>${escapeHtml(event.name || "Community Ambassador Meetup")}</h3><p>${escapeHtml(`${date.weekday} · ${date.time} · ${event.location || "Boekenbergpark"}`)}</p></div>${event.url ? `<a href="${escapeHtml(event.url)}" target="_blank" rel="noopener" aria-label="Open ${escapeHtml(event.name)}">↗</a>` : ""}</article>`;
    }).join("");
  }

  function renderMeetupFeedError() {
    $("#featuredMeetup").innerHTML = '<h3>Meetup feed temporarily unavailable.</h3><p>The calendar could not be refreshed. Open Campfire or join Discord for the latest local plans.</p><a href="https://discord.gg/QMDWYzHccS" target="_blank" rel="noopener">Check Discord ↗</a>';
    $("#meetupStatus").textContent = "Could not refresh";
    $("#meetupList").innerHTML = '<div class="empty-state">We could not reach the live meetup calendar. Please try again shortly.</div>';
  }

  function distanceMeters(firstLatitude, firstLongitude, secondLatitude, secondLongitude) {
    const radians = value => value * Math.PI / 180;
    const latitude = radians(secondLatitude - firstLatitude), longitude = radians(secondLongitude - firstLongitude);
    const value = Math.sin(latitude / 2) ** 2 + Math.cos(radians(firstLatitude)) * Math.cos(radians(secondLatitude)) * Math.sin(longitude / 2) ** 2;
    return 12742000 * Math.asin(Math.sqrt(value));
  }

  function meetupArea(latitude, longitude) {
    return (CONFIG.meetupAreas || []).find(area => distanceMeters(area.latitude, area.longitude, latitude, longitude) <= area.radiusMeters) || null;
  }

  function meetupCellIds() {
    if (!window.S2?.latLngToKey || !window.S2?.keyToId) throw new Error("S2 library unavailable");
    const ids = new Set();
    for (const area of CONFIG.meetupAreas || []) {
      const latitudeSpan = area.radiusMeters / 111320;
      const longitudeSpan = latitudeSpan / Math.cos(area.latitude * Math.PI / 180);
      for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++)
        ids.add(S2.keyToId(S2.latLngToKey(area.latitude + y * latitudeSpan, area.longitude + x * longitudeSpan, 14)));
    }
    return [...ids];
  }

  async function nianticRequest(query, variables) {
    const response = await fetch(CONFIG.nianticGraphqlUrl, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables })
    });
    if (!response.ok) throw new Error(`Niantic returned HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.errors?.length) throw new Error("Niantic returned GraphQL errors");
    return payload;
  }

  async function meetupDetails(meetup) {
    try {
      const payload = await nianticRequest(MEETUP_DETAIL_QUERY, { id: meetup.eventId });
      const details = payload.data?.event;
      if (!details) return meetup;
      return {
        ...meetup,
        name: String(details.name || details.campfireLiveEvent?.eventName || meetup.name),
        location: String(details.address || meetup.location),
        start: localDate(details.eventTime) || meetup.start,
        end: localDate(details.eventEndTime) || meetup.end
      };
    } catch { return meetup; }
  }

  async function loadMeetupsFromGraphql() {
    if (!CONFIG.nianticGraphqlUrl || !CONFIG.nianticRealityChannelId) throw new Error("Meetup GraphQL source is not configured");
    const sourcesByS2Cells = meetupCellIds().map(s2CellId => ({ s2CellId, sources: [{ name: "PGO", dropTypes: ["CA_EVENT"] }] }));
    const payload = await nianticRequest(MEETUP_MAP_QUERY, { input: { realityChannelId: CONFIG.nianticRealityChannelId, s2CellLevel: 14, sourcesByS2Cells } });
    const groups = payload.data?.realityChannelMapObjectsByS2Cells?.mapObjectsByS2CellsAndTypes || [];
    const meetups = new Map();
    for (const cell of groups) for (const typed of cell.mapObjectsByType || []) {
      if (typed.type !== "CA_EVENT") continue;
      for (const object of typed.mapObjects || []) {
        const event = object.event;
        const latitude = Number(event?.mapObjectLocation?.latitude), longitude = Number(event?.mapObjectLocation?.longitude);
        const area = meetupArea(latitude, longitude), start = localDate(event?.eventTime), end = localDate(event?.eventEndTime || event?.eventTime);
        if (!event?.id || !area || !start || !end || end.getTime() < Date.now() || start.getTime() > Date.now() + 180 * 86400000) continue;
        meetups.set(String(event.id), {
          eventId: String(event.id),
          name: String(event.campfireLiveEvent?.eventType || "Community Ambassador Meetup"),
          start,
          end,
          location: String(event.location || area.name),
          url: `https://campfire.nianticlabs.com/discover/meetup/${encodeURIComponent(event.id)}`
        });
      }
    }
    return (await Promise.all([...meetups.values()].map(meetupDetails))).sort((first, second) => first.start - second.start);
  }

  function cacheMeetups(cacheKey, meetups) {
    localStorage.setItem(cacheKey, JSON.stringify(meetups.map(event => ({ ...event, start: event.start.toISOString(), end: event.end?.toISOString() || "" }))));
  }

  function cachedMeetups(cacheKey) {
    return JSON.parse(localStorage.getItem(cacheKey) || "[]").map(event => ({ ...event, start: localDate(event.start), end: localDate(event.end) })).filter(event => event.start && (event.end || event.start).getTime() >= Date.now());
  }

  async function loadEvents() {
    try {
      const [eventsResponse, pokemonData] = await Promise.all([fetch(CONFIG.eventsUrl, { cache: "no-store" }), loadPokemonData().catch(() => [])]);
      if (!eventsResponse.ok) throw new Error("Event feed unavailable");
      const payload = await eventsResponse.json();
      const events = Array.isArray(payload) ? payload : payload.events || [];
      renderEvents(events, pokemonData);
      $("#eventFreshness").textContent = `Live event feed · updated ${new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date())}`;
    } catch {
      $("#activeEvents").innerHTML = '<div class="empty-state">The live event feed could not be reached. Use “All game events” for the latest details.</div>';
      $("#eventFreshness").textContent = "Live data temporarily unavailable";
    }
  }

  async function loadMeetups() {
    const cacheKey = "pogo-home-meetups-v1";
    let graphqlSucceeded = false;
    try {
      const meetups = await loadMeetupsFromGraphql();
      graphqlSucceeded = true;
      if (meetups.length) {
        cacheMeetups(cacheKey, meetups);
        renderMeetups(meetups);
        return;
      }
    } catch {}
    try {
      const response = await fetch(CONFIG.meetupCalendarUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("Meetup feed unavailable");
      const meetups = parseMeetups(await response.text());
      cacheMeetups(cacheKey, meetups);
      renderMeetups(meetups);
      return;
    } catch {}
    if (graphqlSucceeded) {
      renderMeetups([]);
      return;
    }
    try {
      const cached = cachedMeetups(cacheKey);
      if (cached.length) { renderMeetups(cached); return; }
    } catch {}
    renderMeetupFeedError();
  }

  function updateCountdowns() {
    $$('[data-countdown]').forEach(element => {
      const end = localDate(element.dataset.countdown);
      if (end) element.textContent = relativeTime(end);
    });
  }

  function registerInstallExperience() {
    const button = $("#installApp");
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    let installPrompt = null;

    if (!standalone && isIos) button.hidden = false;
    window.addEventListener("beforeinstallprompt", event => {
      event.preventDefault();
      installPrompt = event;
      button.hidden = false;
    });
    window.addEventListener("appinstalled", () => {
      installPrompt = null;
      button.hidden = true;
    });
    button.addEventListener("click", async () => {
      if (installPrompt) {
        installPrompt.prompt();
        await installPrompt.userChoice;
        installPrompt = null;
        button.hidden = true;
        return;
      }
      if (isIos) window.alert("In Safari, tap the Share button, then choose Add to Home Screen.");
    });
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js", { scope: "./", updateViaCache: "none" }).then(registration => registration.update()).catch(() => {}));
  }

  loadEvents();
  loadMeetups();
  updateCountdowns();
  registerInstallExperience();
  registerServiceWorker();
  setInterval(updateCountdowns, 60000);
})();
