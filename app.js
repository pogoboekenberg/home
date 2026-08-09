(() => {
  "use strict";

  const CONFIG = window.POGO_HOME_CONFIG || {};
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const safeUrl = value => /^https:\/\//i.test(String(value || "")) ? String(value) : "";
  const MEETUP_MAP_QUERY = `query HomeMeetups($input: RealityChannelMapObjectsByS2CellsInput!) { realityChannelMapObjectsByS2Cells(input: $input) { mapObjectsByS2CellsAndTypes { mapObjectsByType { type mapObjects { id event { id location eventTime eventEndTime mapObjectLocation { latitude longitude } campfireLiveEvent { eventType id } } } } } } }`;
  const MEETUP_DETAIL_QUERY = `query HomeMeetupDetails($id: ID!) { event(id: $id) { id name address eventTime eventEndTime members(first: 1) { totalCount } campfireLiveEvent { eventName eventType id } } }`;
  const RAID_BOSS_FILTER_KEY = "pogo-home-raid-boss-filter-v1";
  const LANGUAGE_KEY = "pogo-home-language-v1";
  let currentLanguage = (() => {
    try {
      const saved = localStorage.getItem(LANGUAGE_KEY);
      if (saved === "en" || saved === "nl") return saved;
    } catch {}
    return "nl";
  })();
  let latestEvents = null, latestPokemonData = [], latestMeetups = null;
  const TRANSLATION_PAIRS = [
    ["Language", "Taal"], ["Global navigation", "Hoofdnavigatie"], ["Community pages", "Communitypagina's"],
    ["Join Discord", "Word lid van Discord"], ["Join PoGo Boekenberg on Discord", "Word lid van PoGo Boekenberg op Discord"], ["Open map", "Kaart openen"], ["Map", "Kaart"],
    ["Bonuses", "Bonussen"], ["Perfect CP", "Perfecte CP"], ["Deurne · Antwerp", "Deurne · Antwerpen"], ["Your local", "Jouw lokale"],
    ["community.", "community."], ["meetups.", "meetups."],
    ["Meet up, explore Boekenberg, and never miss the bonuses worth playing for.", "Spreek af, verken Boekenberg en mis geen enkele bonus die de moeite waard is."],
    ["Choose what you need: local meetups, useful in-game bonuses, or perfect raid CP.", "Kies wat je nodig hebt: lokale meetups, nuttige in-gamebonussen of perfecte raid-CP."],
    ["Explore the live map", "Bekijk de live kaart"], ["Install app", "App installeren"], ["Community essentials", "Community-info"],
    ["Three focused", "Drie overzichtelijke"], ["pages.", "pagina's."], ["No dashboard clutter—open the page for the information you want.", "Geen druk dashboard—open alleen de pagina met de informatie die je zoekt."],
    ["Play together", "Samen spelen"], ["Upcoming local events, Campfire links, and check-in rewards.", "Komende lokale evenementen, Campfire-links en check-inbeloningen."],
    ["Worth knowing", "Handig om te weten"], ["Current and upcoming gameplay bonuses, split into free and paid.", "Huidige en komende gameplaybonussen, opgesplitst in gratis en betaald."],
    ["Raid ready", "Klaar voor raids"], ["Current hundo catch CP and upcoming 5★ and Mega rotations.", "Huidige hundo vang-CP en komende 5★- en Mega-rotaties."],
    ["Made for trainers around Boekenbergpark.", "Gemaakt voor trainers rond het Boekenbergpark."],
    ["Upcoming", "Komende"], ["Community Ambassador events around Boekenbergpark and Te Boelaarpark, synced from Campfire.", "Community Ambassador-evenementen rond het Boekenbergpark en Te Boelaarpark, gesynchroniseerd met Campfire."],
    ["Next community meetup", "Volgende community-meetup"], ["Loading…", "Laden…"], ["Coming up", "Binnenkort"], ["Local", "Lokale"], ["calendar.", "kalender."],
    ["Open any meetup on Campfire or add the full community feed to your calendar.", "Open een meetup op Campfire of voeg de volledige communitykalender toe aan je agenda."], ["Add all to calendar", "Alles aan agenda toevoegen"],
    ["Live in-game", "Live in-game"], ["Useful", "Nuttige"], ["bonuses.", "bonussen."], ["Current and upcoming gameplay effects, condensed to the bonuses that change how you play.", "Huidige en komende gameplay-effecten, beperkt tot de bonussen die echt invloed hebben op hoe je speelt."],
    ["Gameplay bonuses", "Gameplaybonussen"], ["Now and coming up", "Nu en binnenkort"], ["Free and paid marked", "Gratis en betaald aangeduid"], ["Active now", "Nu actief"],
    ["Checking the live event feed…", "Live eventfeed controleren…"], ["All game events", "Alle game-events"],
    ["Perfect", "Perfecte"], ["catch CP.", "vang-CP."], ["Current hundo CP and the upcoming weekly boss schedule. Upcoming cards stay compact until their rotation starts.", "Huidige hundo-CP en het komende wekelijkse bazenschema. Komende kaarten blijven compact tot hun rotatie begint."],
    ["Featured Pokémon", "Uitgelichte Pokémon"], ["Hundo CP at a glance", "Hundo-CP in één oogopslag"], ["Upcoming weekly raid bosses", "Komende wekelijkse raidbazen"], ["All raid events", "Alle raid-events"],
    ["When", "Wanneer"], ["Where", "Waar"], ["Going", "Aanwezig"], ["Check-in rewards", "Check-inbeloningen"], ["Featured Pokémon CP", "Uitgelichte Pokémon-CP"],
    ["View meetup on Campfire", "Bekijk meetup op Campfire"], ["Join the community", "Word lid van de community"], ["Check Discord", "Bekijk Discord"],
    ["Normal", "Normaal"], ["Boosted", "Weerboost"], ["Unavailable", "Niet beschikbaar"], ["CP unavailable", "CP niet beschikbaar"], ["Free", "Gratis"], ["Paid", "Betaald"],
    ["New meetup dates coming soon.", "Nieuwe meetupdata volgen binnenkort."], ["To be announced", "Nog aan te kondigen"], ["Could not refresh", "Kon niet vernieuwen"], ["Live data temporarily unavailable", "Live data tijdelijk niet beschikbaar"]
  ];
  const EN_TO_NL = new Map(TRANSLATION_PAIRS), NL_TO_EN = new Map(TRANSLATION_PAIRS.map(([english, dutch]) => [dutch, english]));
  const tr = (english, dutch) => currentLanguage === "nl" ? dutch : english;
  let activeRaidBossEntries = [];
  let upcomingRaidBossEntries = [];
  let raidBossFilters = (() => {
    try {
      const saved = localStorage.getItem(RAID_BOSS_FILTER_KEY);
      if (saved === "both") return new Set(["five", "mega"]);
      if (saved === "mega" || saved === "five") return new Set([saved]);
      const parsed = JSON.parse(saved || "null");
      if (Array.isArray(parsed)) return new Set(parsed.filter(value => value === "five" || value === "mega"));
    } catch {}
    return new Set(["five", "mega"]);
  })();
  const localDate = value => {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  };

  $$('[data-map-link]').forEach(link => { link.href = CONFIG.mapUrl || "../map/"; });
  $$('.discord-button, a[href*="discord.gg"]').forEach(link => { link.href = CONFIG.discordUrl || "https://discord.gg/QMDWYzHccS"; });
  const calendarLink = $("#calendarLink");
  if (calendarLink) calendarLink.href = CONFIG.meetupCalendarUrl;

  function translateStaticValue(value) {
    const english = NL_TO_EN.get(value) || value;
    return currentLanguage === "nl" ? EN_TO_NL.get(english) || value : english;
  }

  function applyLanguage() {
    document.documentElement.lang = currentLanguage;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (/^(?:SCRIPT|STYLE)$/i.test(node.parentElement?.tagName || "")) continue;
      const trimmed = node.nodeValue.trim();
      if (!trimmed) continue;
      const translated = translateStaticValue(trimmed);
      if (translated !== trimmed) node.nodeValue = node.nodeValue.replace(trimmed, translated);
    }
    $$('[aria-label], [title]').forEach(element => {
      for (const attribute of ["aria-label", "title"]) {
        const value = element.getAttribute(attribute);
        if (value) element.setAttribute(attribute, translateStaticValue(value));
      }
    });
    $$('[data-language]').forEach(button => {
      const active = button.dataset.language === currentLanguage;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    const pageTitle = document.body.classList.contains("meetups-page") ? tr("Meetups · PoGo Boekenberg", "Meetups · PoGo Boekenberg") : document.body.classList.contains("bonuses-page") ? tr("Bonuses · PoGo Boekenberg", "Bonussen · PoGo Boekenberg") : document.body.classList.contains("cp-page") ? tr("Perfect CP · PoGo Boekenberg", "Perfecte CP · PoGo Boekenberg") : tr("PoGo Boekenberg · Home", "PoGo Boekenberg · Home");
    document.title = pageTitle;
  }

  function registerLanguageToggle() {
    $$('[data-language]').forEach(button => button.addEventListener("click", () => {
      const language = button.dataset.language;
      if (language !== "en" && language !== "nl" || language === currentLanguage) return;
      currentLanguage = language;
      try { localStorage.setItem(LANGUAGE_KEY, currentLanguage); } catch {}
      applyLanguage();
      updateCountdowns();
      if (latestMeetups) renderMeetups(latestMeetups);
      if (latestEvents) renderEvents(latestEvents, latestPokemonData).then(applyLanguage);
    }));
  }

  function relativeTime(target, now = Date.now()) {
    const milliseconds = target.getTime() - now;
    if (milliseconds <= 0) return tr("ending now", "eindigt nu");
    const minutes = Math.ceil(milliseconds / 60000);
    if (minutes < 60) return tr(`${minutes}m left`, `${minutes} min over`);
    const hours = Math.ceil(minutes / 60);
    if (hours < 24) return tr(`${hours}h left`, `${hours}u over`);
    const days = Math.ceil(hours / 24);
    return tr(`${days}d left`, `${days}d over`);
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

  async function liveEventBonuses(event) {
    const structured = eventBonuses(event);
    if (structured.length) return structured;
    const url = safeUrl(event.link);
    if (!/^https:\/\/leekduck\.com\/events\//i.test(url)) return [];
    const cacheKey = `pogo-home-event-bonuses-v2:${url}`;
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
      if (Array.isArray(cached?.bonuses) && Date.now() - Number(cached.savedAt) < 21600000) return cached.bonuses;
    } catch {}
    try {
      const response = await fetch(url, { cache: "force-cache", credentials: "omit" });
      if (!response.ok) throw new Error("Bonus page unavailable");
      const documentNode = new DOMParser().parseFromString(await response.text(), "text/html");
      const seen = new Set(), bonuses = [];
      documentNode.querySelectorAll(".bonus-list .bonus-text").forEach(node => {
        const text = String(node.textContent || "").replace(/\s+/g, " ").trim();
        const key = text.toLocaleLowerCase("en");
        if (!text || seen.has(key)) return;
        seen.add(key);
        const list = node.closest(".bonus-list");
        let sibling = list?.previousElementSibling, paid = false;
        while (sibling) {
          if (/^H[2-4]$/.test(sibling.tagName)) {
            paid = /ticket|deluxe|paid/i.test(String(sibling.textContent || ""));
            break;
          }
          sibling = sibling.previousElementSibling;
        }
        bonuses.push(paid && !/^(?:GO Pass Deluxe|Deluxe Pass|Paid):/i.test(text) ? `Paid: ${text}` : text);
      });
      localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), bonuses }));
      return bonuses;
    } catch { return []; }
  }

  function bonusMark(text) {
    if (/stardust/i.test(text)) return "✦";
    if (/raid pass|raid/i.test(text)) return "R";
    if (/candy/i.test(text)) return "×";
    if (/\bxp\b/i.test(text)) return "XP";
    if (/egg|hatch/i.test(text)) return "½";
    return "+";
  }

  function usefulBonuses(bonuses, limit = 2) {
    const priority = text => /raid pass/i.test(text) ? 10 : /stardust/i.test(text) ? 9 : /egg|hatch/i.test(text) ? 8 : /candy/i.test(text) ? 7 : /\bxp\b/i.test(text) ? 6 : /trade/i.test(text) ? 5 : 1;
    const concise = text => String(text || "")
      .replace(/\s+when Eggs are placed in an Incubator during the event period\.?$/i, "")
      .replace(/\s+during the event period\.?$/i, "")
      .replace(/\b1\/2(?=\s+Egg)/gi, "½")
      .replace(/\b1\/4(?=\s+Egg)/gi, "¼")
      .replace(/^One additional Special Trade can be made for a maximum of (?:two|2) for the day\*?$/i, "+1 Special Trade · 2 total")
      .replace(/\s*\.\s*$/, "")
      .replace(/\s+/g, " ").trim();
    const mergeTiers = values => {
      const numberWords = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20 };
      const grouped = new Map(), standalone = [];
      const add = (key, item) => {
        const group = grouped.get(key);
        if (!group) grouped.set(key, { ...item, count: 1, freeAmount: item.paid ? null : item.amount, paidAmount: item.paid ? item.amount : null });
        else {
          group.count += 1;
          group.amount = item.stronger(item.amount, group.amount) ? item.amount : group.amount;
          const accessKey = item.paid ? "paidAmount" : "freeAmount";
          if (group[accessKey] === null || item.stronger(item.amount, group[accessKey])) group[accessKey] = item.amount;
        }
      };
      for (const original of values) {
        const paid = /^(?:GO Pass Deluxe|Deluxe Pass|Paid):/i.test(original);
        const value = original.replace(/^(?:GO Pass Deluxe|Deluxe Pass|Paid):\s*/i, "");
        const multiplier = value.match(/^(\d+(?:\.\d+)?)\s*(?:×|x)\s+(.+)$/i);
        if (multiplier) {
          const label = multiplier[2].trim(), amount = Number(multiplier[1]);
          add(`multiplier:${label.toLocaleLowerCase("en")}`, { kind: "multiplier", label, amount, original, paid, stronger: (next, current) => next > current });
          continue;
        }
        const fraction = value.match(/^(½|¼)\s+(.+)$/i);
        if (fraction) {
          const label = fraction[2].trim(), amount = fraction[1] === "¼" ? .25 : .5;
          add(`fraction:${label.toLocaleLowerCase("en")}`, { kind: "fraction", label, amount, original, paid, stronger: (next, current) => next < current });
          continue;
        }
        const passes = value.match(/^Receive up to (\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+(?:additional\s+)?(?:free\s+)?Raid Pass(?:es)?(.*)$/i);
        if (passes) {
          const amount = Number(passes[1]) || numberWords[passes[1].toLocaleLowerCase("en")], label = passes[2].trim();
          add(`passes:${label.toLocaleLowerCase("en")}`, { kind: "passes", label, amount, original, paid, stronger: (next, current) => next > current });
          continue;
        }
        standalone.push(original);
      }
      for (const group of grouped.values()) {
        if (group.count === 1) { standalone.push(group.original); continue; }
        const access = formatter => group.freeAmount !== null && group.paidAmount !== null ? ` (Free: ${formatter(group.freeAmount)} · Paid: ${formatter(group.paidAmount)})` : group.paidAmount !== null ? ` (Paid: ${formatter(group.paidAmount)})` : "";
        if (group.kind === "multiplier") standalone.push(`Up to ${group.amount}× ${group.label}${access(amount => `${amount}×`)}`);
        else if (group.kind === "fraction") standalone.push(`Up to ${group.amount === .25 ? "¼" : "½"} ${group.label}${access(amount => amount === .25 ? "¼" : "½")}`);
        else standalone.push(`Receive up to ${group.amount} Raid Passes${group.label ? ` ${group.label}` : ""}${access(String)}`);
      }
      return standalone;
    };
    const isGameplayEffect = text => {
      const value = String(text || "").trim();
      if (!value || /(?:×|x)\s*\d+\s*$/i.test(value)) return false;
      if (/\btrades?\b/i.test(value) && /stardust|less|reduc|discount|cost/i.test(value)) return false;
      if (/\btrades?\b/i.test(value) && !/\bspecial trades?\b/i.test(value)) return false;
      return /\d+\s*(?:×|x)(?:\s|$)|\d+(?:-|\s)?hour\b|\b(?:increased|decreased|additional|extra|free|reduced|guaranteed|chance|distance|duration|double|triple|half|trade|trades|raid pass|raid passes|attract|last|require|limit)\b/i.test(value);
    };
    return mergeTiers([...bonuses].map(concise)).filter(isGameplayEffect).sort((first, second) => priority(second) - priority(first)).slice(0, limit);
  }

  function startsIn(target, now = Date.now()) {
    const text = relativeTime(target, now);
    if (text === "ending now" || text === "eindigt nu") return tr("starting now", "begint nu");
    const duration = text.replace(/(?: left| over)$/, "");
    return tr(`starts in ${duration}`, `begint over ${duration}`);
  }

  function bonusTitleMarkup(bonus) {
    const split = String(bonus).match(/^(.*?)\s*\(Free:\s*(.*?)\s*·\s*Paid:\s*(.*?)\)$/i);
    if (split) return `<b>${escapeHtml(split[1])}</b><span class="bonus-access"><i class="free-tier">${tr("Free", "Gratis")} ${escapeHtml(split[2])}</i><i class="paid-tier">${tr("Paid", "Betaald")} ${escapeHtml(split[3])}</i></span>`;
    const paid = String(bonus).match(/^(.*?)\s*\(Paid:\s*(.*?)\)$/i);
    if (paid) return `<b>${escapeHtml(paid[1])}</b><span class="bonus-access"><i class="paid-tier">${tr("Paid", "Betaald")} ${escapeHtml(paid[2])}</i></span>`;
    return `<b>${escapeHtml(bonus)}</b>`;
  }

  function renderBonusCard({ bonus, event, time }, upcoming = false) {
    const link = safeUrl(event.link) || "https://leekduck.com/events/";
    const countdown = upcoming ? startsIn(time) : relativeTime(time);
    return `<a class="bonus-card${upcoming ? " upcoming-bonus" : ""}" href="${escapeHtml(link)}" target="_blank" rel="noopener"><span class="bonus-mark" aria-hidden="true">${escapeHtml(bonusMark(bonus))}</span><span class="bonus-copy">${bonusTitleMarkup(bonus)}<small>${escapeHtml(event.name || "Live event")} · <i data-countdown="${escapeHtml(time.toISOString())}"${upcoming ? ' data-countdown-mode="starts"' : ""}>${countdown}</i></small></span><span class="bonus-arrow" aria-hidden="true">↗</span></a>`;
  }

  function featuredPokemonEntry(event, boss, pokemonData, time) {
    const stats = pokemonStatsForBoss(boss, pokemonData);
    const shadow = /\bshadow\b/i.test(`${boss.name || ""} ${event.name || ""} ${event.heading || ""}`);
    return { boss, event, normal: pokemonCp(stats, .59740001), boosted: boss.isMaxBattle ? null : pokemonCp(stats, .667934), weather: weatherTypes(stats), shadow, time };
  }

  function renderFeaturedPokemon({ boss, event, normal, boosted, weather, shadow, time }, upcoming = false) {
    const name = boss.name.replace(/^(Gigantamax|Dynamax|Shadow)\s+/i, "");
    const link = safeUrl(event.link) || "https://leekduck.com/events/";
    const countdown = upcoming ? startsIn(time) : relativeTime(time);
    return `<article class="featured-pokemon-card${upcoming ? " upcoming-raid-card" : ""}${shadow ? " shadow-boss-card" : ""}"><a href="${escapeHtml(link)}" target="_blank" rel="noopener">
      <div class="featured-mon-art${shadow ? " shadow" : ""}">${boss.image ? `<img src="${escapeHtml(boss.image)}" alt="" loading="lazy">` : `<span aria-hidden="true">${escapeHtml(name.charAt(0))}</span>`}</div>
      <div class="featured-mon-info"><div class="featured-mon-top"><h4>${shadow ? '<i class="shadow-chip">Shadow</i>' : ""}${escapeHtml(name)}</h4><span data-countdown="${escapeHtml(time.toISOString())}"${upcoming ? ' data-countdown-mode="starts"' : ""}>${countdown}</span></div>
      ${upcoming ? "" : `<div class="pokemon-cp"><span class="cp-stat"><small>${tr("Normal", "Normaal")}</small><b>${normal ? `${normal.toLocaleString()} CP` : tr("Unavailable", "Niet beschikbaar")}</b></span>${boosted ? `<span class="cp-stat boosted"><small>${tr("Boosted", "Weerboost")}${weather ? ` · ${escapeHtml(weather)}` : ""}</small><b>${boosted.toLocaleString()} CP</b></span>` : ""}</div>`}</div>
    </a></article>`;
  }

  function raidBossTier({ boss, event }) {
    if (boss?.isMaxBattle) return "max";
    return /\b(?:mega|primal)\b/i.test(`${boss?.name || ""} ${event?.name || ""} ${event?.heading || ""}`) ? "mega" : "five";
  }

  function syncRaidBossToggle() {
    $$('[data-raid-boss-filter]').forEach(button => {
      const active = raidBossFilters.has(button.dataset.raidBossFilter);
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function renderRaidBossRows() {
    const label = raidBossFilters.size === 2 ? "raid" : raidBossFilters.has("mega") ? "Mega" : raidBossFilters.has("five") ? "5-star" : "selected raid";
    const matchesFilter = item => raidBossFilters.has(raidBossTier(item));
    const activeMatches = activeRaidBossEntries.filter(matchesFilter);
    const upcomingMatches = upcomingRaidBossEntries.filter(matchesFilter);
    const activeTarget = $("#featuredPokemon"), upcomingTarget = $("#upcomingRaidBosses");
    if (activeTarget) activeTarget.innerHTML = activeMatches.length
      ? activeMatches.slice(0, 8).map(item => renderFeaturedPokemon(item)).join("")
      : `<div class="empty-state compact-empty">${raidBossFilters.size ? tr(`No ${label} boss rotation is active right now.`, `Er is momenteel geen passende ${label === "raid" ? "raidbaas" : label + "-baas"}-rotatie actief.`) : tr("Choose 5★, Mega, or both above.", "Kies hierboven 5★, Mega of beide.")}</div>`;
    if (upcomingTarget) upcomingTarget.innerHTML = upcomingMatches.length
      ? upcomingMatches.slice(0, 8).map(item => renderFeaturedPokemon(item, true)).join("")
      : `<div class="empty-state compact-empty">${raidBossFilters.size ? tr(`No upcoming ${label} rotation has been announced yet.`, `Er is nog geen komende ${label === "raid" ? "raid" : label}-rotatie aangekondigd.`) : tr("Choose 5★, Mega, or both above.", "Kies hierboven 5★, Mega of beide.")}</div>`;
    syncRaidBossToggle();
    applyLanguage();
  }

  function registerRaidBossToggle() {
    syncRaidBossToggle();
    $$('[data-raid-boss-filter]').forEach(button => button.addEventListener("click", () => {
      const filter = button.dataset.raidBossFilter;
      if (raidBossFilters.has(filter)) raidBossFilters.delete(filter);
      else raidBossFilters.add(filter);
      try { localStorage.setItem(RAID_BOSS_FILTER_KEY, JSON.stringify([...raidBossFilters])); } catch {}
      renderRaidBossRows();
    }));
  }

  async function renderEvents(events, pokemonData) {
    latestEvents = events;
    latestPokemonData = pokemonData;
    const now = Date.now();
    const active = events.filter(event => {
      const start = localDate(event.start), end = localDate(event.end);
      return start && end && start.getTime() <= now && end.getTime() > now;
    }).sort((a, b) => eventScore(b) - eventScore(a) || localDate(a.end) - localDate(b.end)).slice(0, 8);
    const upcoming = events.filter(event => {
      const start = localDate(event.start), end = localDate(event.end);
      const type = String(event.eventType || "");
      return start && end && start.getTime() > now && end.getTime() > now && !/^(?:raid-battles|max-mondays|go-battle-league|raid-hour)$/i.test(type);
    }).sort((a, b) => localDate(a.start) - localDate(b.start)).slice(0, 8);

    if ($("#featuredPokemon")) {
      const featured = [], seenFeatured = new Set();
      for (const event of active) {
        for (const boss of featuredBosses(event)) {
          const key = String(boss.name).toLocaleLowerCase("en");
          if (seenFeatured.has(key)) continue;
          seenFeatured.add(key);
          featured.push(featuredPokemonEntry(event, boss, pokemonData, localDate(event.end)));
        }
      }
      activeRaidBossEntries = featured;

      const upcomingRaids = events.filter(event => {
        const start = localDate(event.start), end = localDate(event.end);
        return start && end && start.getTime() > now && end.getTime() > now && String(event.eventType || "").toLocaleLowerCase("en") === "raid-battles";
      }).sort((a, b) => localDate(a.start) - localDate(b.start));
      const nextBosses = [], seenNextBosses = new Set();
      for (const event of upcomingRaids) for (const boss of featuredBosses(event)) {
        const key = String(boss.name).toLocaleLowerCase("en");
        if (seenNextBosses.has(key)) continue;
        seenNextBosses.add(key);
        nextBosses.push(featuredPokemonEntry(event, boss, pokemonData, localDate(event.start)));
      }
      upcomingRaidBossEntries = nextBosses;
      renderRaidBossRows();
    }

    if (!$("#activeBonuses")) return;

    const [bonusGroups, upcomingBonusGroups] = await Promise.all([
      Promise.all(active.map(async event => ({ event, bonuses: await liveEventBonuses(event) }))),
      Promise.all(upcoming.map(async event => ({ event, bonuses: await liveEventBonuses(event) })))
    ]);
    const bonusItems = [], seenBonuses = new Set();
    for (const { event, bonuses } of bonusGroups) for (const bonus of usefulBonuses(bonuses)) {
      const key = bonus.toLocaleLowerCase("en");
      if (seenBonuses.has(key)) continue;
      seenBonuses.add(key);
      bonusItems.push({ bonus, event, end: localDate(event.end) });
    }
    const activeBonusTarget = $("#activeBonuses");
    if (activeBonusTarget) activeBonusTarget.innerHTML = bonusItems.length ? bonusItems.slice(0, 8).map(item => renderBonusCard({ bonus: item.bonus, event: item.event, time: item.end })).join("") : `<div class="empty-state compact-empty">${tr("No event-wide bonuses are active right now.", "Er zijn momenteel geen algemene evenementbonussen actief.")}</div>`;

    const upcomingBonusItems = [], seenUpcomingBonuses = new Set();
    for (const { event, bonuses } of upcomingBonusGroups) for (const bonus of usefulBonuses(bonuses)) {
      const key = bonus.toLocaleLowerCase("en");
      if (seenUpcomingBonuses.has(key)) continue;
      seenUpcomingBonuses.add(key);
      upcomingBonusItems.push({ bonus, event, start: localDate(event.start) });
    }
    const upcomingBonusTarget = $("#upcomingBonuses");
    if (upcomingBonusTarget) upcomingBonusTarget.innerHTML = upcomingBonusItems.length ? upcomingBonusItems.slice(0, 8).map(item => renderBonusCard({ bonus: item.bonus, event: item.event, time: item.start }, true)).join("") : `<div class="empty-state compact-empty">${tr("No upcoming event bonuses have been announced yet.", "Er zijn nog geen komende evenementbonussen aangekondigd.")}</div>`;
    applyLanguage();
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
    const locale = currentLanguage === "nl" ? "nl-BE" : undefined;
    return { day: new Intl.DateTimeFormat(locale, { day: "2-digit" }).format(date), month: new Intl.DateTimeFormat(locale, { month: "short" }).format(date), weekday: new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date), time: new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(date) };
  }

  function expectedMeetupRewards(event) {
    if (!event.liveEventId) return [];
    const name = String(event.liveEventName || event.eventType || "").toLocaleLowerCase("en");
    const reward = (label, image, amount = "") => ({ label, image: `assets/meetup-rewards/${image}.webp`, amount });
    if (name.includes("go tour") && name.includes("kalos")) return [reward("500 Link Charges", "link-charge", "500"), reward("Serena encounter", "serena"), reward("Calem encounter", "calem")];
    if (name.includes("go fest") && name.includes("2026")) return [reward("Yellow-cap Pikachu encounter", "pikachu-cap-yellow"), reward("Red-cap Pikachu encounter", "pikachu-cap-red"), reward("Blue-cap Pikachu encounter", "pikachu-cap-blue")];
    if (name.includes("wild") && name.includes("area")) return [reward("800 Max Particles", "max-particles", "800"), reward("Premium Battle Pass", "premium-battle-pass"), reward("Pokémon encounter", "unknown-encounter")];
    if (name.includes("raid")) return [reward("Premium Battle Pass", "premium-battle-pass")];
    if (name.includes("max")) return [reward("800 Max Particles", "max-particles", "800")];
    if (name.includes("spotlight") || name.includes("hatch")) return [reward("Super Incubator", "super-incubator")];
    if (name.includes("research")) return [reward("Lucky Egg", "lucky-egg"), reward("Incense", "incense"), reward("Lure Module", "lure-module")];
    if (name.includes("community") || /(^|\s)cd(\s|$)/.test(name)) return [reward("Star Piece", "star-piece"), reward("Lucky Egg", "lucky-egg"), reward("Lure Module", "lure-module"), reward("Premium Battle Pass", "premium-battle-pass"), reward("50 Ultra Balls", "ultra-ball", "50"), reward("25 Rare Candy", "rare-candy", "25"), reward("4 Pokémon encounters", "unknown-encounter", "4")];
    return [];
  }

  function renderCheckInRewards(event) {
    const rewards = expectedMeetupRewards(event);
    if (!rewards.length) return "";
    return `<div class="checkin-rewards"><span>${tr("Check-in rewards", "Check-inbeloningen")}</span><ul>${rewards.map(reward => `<li title="${escapeHtml(reward.label)}" aria-label="${escapeHtml(reward.label)}"><img src="${escapeHtml(reward.image)}" alt="" loading="lazy" decoding="async">${reward.amount ? `<b>${escapeHtml(reward.amount)}</b>` : ""}</li>`).join("")}</ul></div>`;
  }

  function renderMeetupBossCp(event) {
    if (!event.bossCp?.length) return "";
    return `<div class="meetup-boss-cp"><span>${tr("Featured Pokémon CP", "Uitgelichte Pokémon-CP")}</span><ul>${event.bossCp.map(boss => `<li>${boss.image ? `<img src="${escapeHtml(boss.image)}" alt="" loading="lazy" decoding="async">` : ""}<span><b>${escapeHtml(boss.name)}</b><small>${boss.normal ? `${boss.normal.toLocaleString()} CP` : tr("CP unavailable", "CP niet beschikbaar")}${boss.boosted ? ` · ${boss.boosted.toLocaleString()} ${tr("boosted", "weerboost")}${boss.weather ? ` · ${escapeHtml(boss.weather)}` : ""}` : ""}</small></span></li>`).join("")}</ul></div>`;
  }

  function eventMatchWords(value) {
    const ignored = new Set(["pokemon", "event", "during", "global", "meetup", "ambassador", "2026"]);
    return new Set(String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en").split(/[^a-z0-9]+/).filter(word => word.length > 2 && !ignored.has(word)));
  }

  function gameEventForMeetup(meetup, events) {
    const start = meetup.start, end = meetup.end || start;
    if (!start) return null;
    const sourceWords = eventMatchWords(`${meetup.name || ""} ${meetup.liveEventName || ""} ${meetup.eventType || ""}`);
    if (!sourceWords.size) return null;
    let best = null;
    for (const event of events) {
      const eventStart = localDate(event.start), eventEnd = localDate(event.end) || eventStart;
      if (!eventStart || !eventEnd || start.getTime() > eventEnd.getTime() + 21600000 || end.getTime() < eventStart.getTime() - 21600000) continue;
      const candidateWords = eventMatchWords(`${event.name || ""} ${event.eventType || ""} ${event.heading || ""}`);
      const shared = [...sourceWords].filter(word => candidateWords.has(word)).length;
      const similarity = shared / Math.max(1, Math.min(sourceWords.size, candidateWords.size));
      const distance = Math.abs(eventStart.getTime() - start.getTime()) / 86400000;
      const score = similarity * 10 - Math.min(3, distance);
      if (shared && (!best || score > best.score)) best = { event, score };
    }
    return best?.score >= 3 ? best.event : null;
  }

  async function enrichMeetupsWithBossCp(meetups) {
    try {
      const [eventsResponse, pokemonData] = await Promise.all([fetch(CONFIG.eventsUrl, { cache: "no-store" }), loadPokemonData()]);
      if (!eventsResponse.ok) return meetups;
      const payload = await eventsResponse.json();
      const events = Array.isArray(payload) ? payload : payload.events || [];
      return meetups.map(meetup => {
        const gameEvent = gameEventForMeetup(meetup, events);
        if (!gameEvent) return meetup;
        const bossCp = featuredBosses(gameEvent).map(boss => {
          const stats = pokemonStatsForBoss(boss, pokemonData);
          const shadow = /\bshadow\b/i.test(`${boss.name || ""} ${gameEvent.name || ""}`);
          const name = shadow && !/^shadow\b/i.test(boss.name) ? `Shadow ${boss.name}` : boss.name;
          return { name, image: boss.image || "", normal: pokemonCp(stats, .59740001), boosted: boss.isMaxBattle ? null : pokemonCp(stats, .667934), weather: weatherTypes(stats) };
        }).filter(boss => boss.name);
        return bossCp.length ? { ...meetup, bossCp } : meetup;
      });
    } catch { return meetups; }
  }

  function renderMeetups(meetups) {
    latestMeetups = meetups;
    if (!meetups.length) {
      $("#featuredMeetup").innerHTML = `<h3>${tr("New meetup dates coming soon.", "Nieuwe meetupdata volgen binnenkort.")}</h3><p>${tr("Join Discord to hear when the next local event is announced.", "Word lid van Discord om te horen wanneer het volgende lokale evenement wordt aangekondigd.")}</p><a href="https://discord.gg/QMDWYzHccS" target="_blank" rel="noopener">${tr("Join the community", "Word lid van de community")} ↗</a>`;
      $("#meetupStatus").textContent = tr("To be announced", "Nog aan te kondigen");
      $("#meetupList").innerHTML = `<div class="empty-state">${tr("No upcoming meetup has been published on Campfire yet.", "Er is nog geen komende meetup op Campfire gepubliceerd.")}</div>`;
      applyLanguage();
      return;
    }
    const first = meetups[0], firstDate = dateParts(first.start);
    const daysAway = Math.ceil((first.start.getTime() - Date.now()) / 86400000);
    $("#meetupStatus").textContent = first.start.getTime() - Date.now() < 86400000 ? tr("Coming up", "Binnenkort") : tr(`${daysAway} days away`, `over ${daysAway} dag${daysAway === 1 ? "" : "en"}`);
    $("#featuredMeetup").innerHTML = `<h3>${escapeHtml(first.name || "Community Ambassador Meetup")}</h3><div class="featured-meta"><div><span>${tr("When", "Wanneer")}</span><b>${escapeHtml(`${firstDate.weekday} ${firstDate.day} ${firstDate.month} · ${firstDate.time}`)}</b></div><div><span>${tr("Where", "Waar")}</span><b>${escapeHtml(first.location || "Boekenbergpark")}</b></div>${Number.isFinite(first.rsvpCount) ? `<div><span>${tr("Going", "Aanwezig")}</span><b>${first.rsvpCount.toLocaleString()} ${tr(`trainer${first.rsvpCount === 1 ? "" : "s"}`, `trainer${first.rsvpCount === 1 ? "" : "s"}`)}</b></div>` : ""}</div>${renderMeetupBossCp(first)}${renderCheckInRewards(first)}${first.url ? `<a href="${escapeHtml(first.url)}" target="_blank" rel="noopener">${tr("View meetup on Campfire", "Bekijk meetup op Campfire")} ↗</a>` : ""}`;
    $("#meetupList").innerHTML = meetups.slice(0, 5).map(event => {
      const date = dateParts(event.start);
      return `<article class="meetup-row"><div class="meetup-date"><b>${escapeHtml(date.day)}</b><span>${escapeHtml(date.month)}</span></div><div class="meetup-info"><div class="meetup-title-row"><h3>${escapeHtml(event.name || "Community Ambassador Meetup")}</h3>${Number.isFinite(event.rsvpCount) ? `<span class="meetup-going">${event.rsvpCount.toLocaleString()} ${tr("going", "aanwezig")}</span>` : ""}</div><p>${escapeHtml(`${date.weekday} · ${date.time} · ${event.location || "Boekenbergpark"}`)}</p>${renderMeetupBossCp(event)}${renderCheckInRewards(event)}</div>${event.url ? `<a href="${escapeHtml(event.url)}" target="_blank" rel="noopener" aria-label="${tr("Open", "Open")} ${escapeHtml(event.name)}">↗</a>` : ""}</article>`;
    }).join("");
    applyLanguage();
  }

  function renderMeetupFeedError() {
    $("#featuredMeetup").innerHTML = `<h3>${tr("Meetup feed temporarily unavailable.", "Meetupfeed tijdelijk niet beschikbaar.")}</h3><p>${tr("The calendar could not be refreshed. Open Campfire or join Discord for the latest local plans.", "De kalender kon niet worden vernieuwd. Open Campfire of Discord voor de recentste lokale plannen.")}</p><a href="https://discord.gg/QMDWYzHccS" target="_blank" rel="noopener">${tr("Check Discord", "Bekijk Discord")} ↗</a>`;
    $("#meetupStatus").textContent = tr("Could not refresh", "Kon niet vernieuwen");
    $("#meetupList").innerHTML = `<div class="empty-state">${tr("We could not reach the live meetup calendar. Please try again shortly.", "We konden de live meetupkalender niet bereiken. Probeer het straks opnieuw.")}</div>`;
    applyLanguage();
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
        end: localDate(details.eventEndTime) || meetup.end,
        eventType: String(details.campfireLiveEvent?.eventType || meetup.eventType || ""),
        liveEventId: String(details.campfireLiveEvent?.id || meetup.liveEventId || ""),
        liveEventName: String(details.campfireLiveEvent?.eventName || meetup.liveEventName || ""),
        rsvpCount: Math.max(0, Number(details.members?.totalCount) || 0)
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
          eventType: String(event.campfireLiveEvent?.eventType || ""),
          liveEventId: String(event.campfireLiveEvent?.id || ""),
          liveEventName: "",
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
      const [eventsResponse, pokemonData] = await Promise.all([fetch(CONFIG.eventsUrl, { cache: "no-store" }), $("#featuredPokemon") ? loadPokemonData().catch(() => []) : Promise.resolve([])]);
      if (!eventsResponse.ok) throw new Error("Event feed unavailable");
      const payload = await eventsResponse.json();
      const events = Array.isArray(payload) ? payload : payload.events || [];
      await renderEvents(events, pokemonData);
      const freshness = $("#eventFreshness");
      const locale = currentLanguage === "nl" ? "nl-BE" : undefined;
      const updatedAt = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date());
      if (freshness) freshness.textContent = tr(`Live event feed · updated ${updatedAt}`, `Live eventfeed · bijgewerkt ${updatedAt}`);
      applyLanguage();
    } catch {
      const messages = [["#featuredPokemon", tr("The featured Pokémon feed could not be reached.", "De feed met uitgelichte Pokémon kon niet worden bereikt.")], ["#upcomingRaidBosses", tr("The upcoming raid boss feed could not be reached.", "De feed met komende raidbazen kon niet worden bereikt.")], ["#activeBonuses", tr("The active bonuses feed could not be reached.", "De feed met actieve bonussen kon niet worden bereikt.")], ["#upcomingBonuses", tr("The upcoming bonuses feed could not be reached.", "De feed met komende bonussen kon niet worden bereikt.")]];
      messages.forEach(([selector, message]) => { const target = $(selector); if (target) target.innerHTML = `<div class="empty-state">${message}</div>`; });
      const freshness = $("#eventFreshness");
      if (freshness) freshness.textContent = tr("Live data temporarily unavailable", "Live data tijdelijk niet beschikbaar");
      applyLanguage();
    }
  }

  async function loadMeetups() {
    const cacheKey = "pogo-home-meetups-v2";
    let graphqlSucceeded = false;
    try {
      const meetups = await loadMeetupsFromGraphql();
      graphqlSucceeded = true;
      if (meetups.length) {
        const enriched = await enrichMeetupsWithBossCp(meetups);
        cacheMeetups(cacheKey, enriched);
        renderMeetups(enriched);
        return;
      }
    } catch {}
    try {
      const response = await fetch(CONFIG.meetupCalendarUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("Meetup feed unavailable");
      const meetups = parseMeetups(await response.text());
      const enriched = await enrichMeetupsWithBossCp(meetups);
      cacheMeetups(cacheKey, enriched);
      renderMeetups(enriched);
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
      if (end) element.textContent = element.dataset.countdownMode === "starts" ? startsIn(end) : relativeTime(end);
    });
  }

  function registerInstallExperience() {
    const button = $("#installApp");
    if (!button) return;
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
      if (isIos) window.alert(tr("In Safari, tap the Share button, then choose Add to Home Screen.", "Tik in Safari op de deelknop en kies daarna 'Zet op beginscherm'."));
    });
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js", { scope: "./", updateViaCache: "none" }).then(registration => registration.update()).catch(() => {}));
  }

  registerLanguageToggle();
  applyLanguage();
  if ($('[data-raid-boss-filter]')) registerRaidBossToggle();
  if ($("#featuredPokemon") || $("#activeBonuses")) loadEvents();
  if ($("#featuredMeetup") || $("#meetupList")) loadMeetups();
  updateCountdowns();
  registerInstallExperience();
  registerServiceWorker();
  setInterval(updateCountdowns, 60000);
})();
