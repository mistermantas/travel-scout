const state = {
  config: null,
  defaultConfig: null,
  cityCatalog: [],
  sourceCatalog: [],
  check: null,
  view: "accepted",
  search: "",
  sort: "score"
};

const amenityLabels = {
  adjustable_climate_control: "Adjustable climate",
  kitchen_or_kitchenette: "Kitchen / kitchenette",
  stovetop: "Stovetop",
  utensils: "Utensils",
  blackout_window_covering: "Blackout covering"
};

const sourceLabels = {
  booking_snapshot: "Booking",
  websearch_cli: "Web search",
  apartment_candidate_snapshot: "Hotels / Expedia",
  accor_snapshot: "Accor",
  serpapi_google_hotels: "Google Hotels",
  fixture: "Fixture"
};

const $ = (selector) => document.querySelector(selector);

document.addEventListener("DOMContentLoaded", bootstrap);

async function bootstrap() {
  wireEvents();
  setLoading(true, "Loading cached offers", "Reading the saved source snapshots.");
  try {
    const payload = await api("/api/bootstrap");
    state.config = clone(payload.config);
    state.defaultConfig = clone(payload.default_config);
    state.cityCatalog = clone(payload.default_config.cities);
    state.sourceCatalog = payload.source_catalog;
    state.check = payload.check;
    syncForm(state.config);
    render();
    $("#run-status").textContent = payload.using_local_config
      ? "Local settings · cached sources"
      : "Preferred defaults · cached sources";
  } catch (error) {
    showToast(error.message, true);
    $("#run-status").textContent = "Could not load results";
    renderEmpty("Travel Scout could not start", error.message);
  } finally {
    setLoading(false);
  }
}

function wireEvents() {
  $("#cached-check").addEventListener("click", () => runCheck(false));
  $("#live-check").addEventListener("click", () => runCheck(true));
  $("#save-config").addEventListener("click", saveConfig);
  $("#cached-check-mobile").addEventListener("click", () => runCheck(false));
  $("#live-check-mobile").addEventListener("click", () => runCheck(true));
  $("#save-config-mobile").addEventListener("click", saveConfig);
  $("#reset-config").addEventListener("click", () => {
    state.config = clone(state.defaultConfig);
    syncForm(state.config);
    showToast("Preferred defaults restored.");
  });
  $("#open-settings").addEventListener("click", () => document.body.classList.add("settings-open"));
  $("#close-settings").addEventListener("click", () => document.body.classList.remove("settings-open"));
  $("#result-search").addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    renderResults();
  });
  $("#result-sort").addEventListener("change", (event) => {
    state.sort = event.target.value;
    renderResults();
  });
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      state.view = tab.dataset.view;
      document.querySelectorAll(".tab").forEach((item) => item.classList.toggle("active", item === tab));
      renderResults();
    });
  });
  $("#config-form").addEventListener("change", () => {
    updateSelectionCounts();
    updateLiveButton();
  });
}

function syncForm(config) {
  $("#preferred-price").value = config.preferred_nightly_price_eur;
  $("#penalty-price").value = config.price_penalty_threshold_eur;
  $("#max-price").value = config.max_nightly_price_eur;
  $("#start-month").value = config.date_horizon.start_months_from_now;
  $("#end-month").value = config.date_horizon.end_months_from_now;
  $("#step-days").value = config.date_horizon.step_days;
  $("#result-limit").value = config.report_top_n;
  $("#min-rating").value = config.minimum_rating.ten_point;
  $("#min-reviews").value = config.minimum_review_count;
  $("#min-transit").value = config.acceptable_transit.min_confidence;
  $("#commute-minutes").value = config.acceptable_transit.reasonable_commute_minutes;
  $("#allow-shared").checked = config.allow_shared_rooms;

  const staySet = new Set(config.stay_lengths.map(Number));
  $("#stay-lengths").innerHTML = [2, 3, 4, 5, 6]
    .map(
      (nights) => `
        <label>
          <input type="checkbox" value="${nights}" ${staySet.has(nights) ? "checked" : ""}>
          <span>${nights}n</span>
        </label>`
    )
    .join("");

  const selectedCities = new Set(config.cities.map((city) => city.name));
  $("#cities").innerHTML = state.cityCatalog
    .map(
      (city) => `
        <label class="check-row" title="${escapeHtml(city.name)}, ${escapeHtml(city.country || "")}">
          <input type="checkbox" value="${escapeAttr(city.name)}" ${selectedCities.has(city.name) ? "checked" : ""}>
          <span>${escapeHtml(city.name)}</span>
        </label>`
    )
    .join("");

  const required = new Set(config.required_amenities);
  const manual = new Set(config.manual_check_amenities || []);
  const amenityKeys = Array.from(new Set([...Object.keys(amenityLabels), ...config.required_amenities]));
  $("#amenities").innerHTML = amenityKeys
    .map(
      (amenity) => `
        <div class="amenity-row" data-amenity="${escapeAttr(amenity)}">
          <label class="amenity-main">
            <input class="amenity-required" type="checkbox" ${required.has(amenity) ? "checked" : ""}>
            <span>${escapeHtml(amenityLabels[amenity] || humanize(amenity))}</span>
          </label>
          <span class="amenity-mode">
            <label>
              <input class="amenity-manual" type="checkbox" ${manual.has(amenity) ? "checked" : ""}>
              <span>warning only</span>
            </label>
          </span>
        </div>`
    )
    .join("");

  const enabledSources = new Set(config.sources_enabled);
  $("#sources").innerHTML = state.sourceCatalog
    .map(
      (source) => `
        <label class="source-row">
          <span class="source-main">
            <input type="checkbox" value="${escapeAttr(source.id)}" ${enabledSources.has(source.id) ? "checked" : ""}>
            <span>${escapeHtml(source.label)}</span>
          </span>
          <span class="source-kind">${escapeHtml(source.kind)}</span>
        </label>`
    )
    .join("");

  $("#amenities").querySelectorAll(".amenity-required").forEach((input) => {
    input.addEventListener("change", () => {
      const manualInput = input.closest(".amenity-row").querySelector(".amenity-manual");
      if (!input.checked) manualInput.checked = false;
      manualInput.disabled = !input.checked;
    });
    input.dispatchEvent(new Event("change"));
  });
  updateSelectionCounts();
  updateLiveButton();
  renderPriceLegend(config);
  refreshIcons();
}

function readForm() {
  const selectedCityNames = new Set(
    Array.from($("#cities").querySelectorAll("input:checked")).map((input) => input.value)
  );
  const requiredAmenities = [];
  const manualAmenities = [];
  $("#amenities").querySelectorAll(".amenity-row").forEach((row) => {
    if (row.querySelector(".amenity-required").checked) requiredAmenities.push(row.dataset.amenity);
    if (row.querySelector(".amenity-manual").checked) manualAmenities.push(row.dataset.amenity);
  });

  return {
    ...clone(state.config || state.defaultConfig),
    cities: state.cityCatalog.filter((city) => selectedCityNames.has(city.name)),
    preferred_nightly_price_eur: numberValue("#preferred-price"),
    price_penalty_threshold_eur: numberValue("#penalty-price"),
    max_nightly_price_eur: numberValue("#max-price"),
    stay_lengths: Array.from($("#stay-lengths").querySelectorAll("input:checked")).map((input) => Number(input.value)),
    date_horizon: {
      start_months_from_now: numberValue("#start-month"),
      end_months_from_now: numberValue("#end-month"),
      step_days: numberValue("#step-days")
    },
    minimum_rating: {
      ten_point: numberValue("#min-rating"),
      five_point: numberValue("#min-rating") / 2
    },
    minimum_review_count: numberValue("#min-reviews"),
    required_amenities: requiredAmenities,
    manual_check_amenities: manualAmenities,
    acceptable_transit: {
      min_confidence: numberValue("#min-transit"),
      reasonable_commute_minutes: numberValue("#commute-minutes")
    },
    sources_enabled: Array.from($("#sources").querySelectorAll("input:checked")).map((input) => input.value),
    allow_shared_rooms: $("#allow-shared").checked,
    report_top_n: numberValue("#result-limit")
  };
}

async function runCheck(liveWebSearch) {
  let config;
  try {
    config = readForm();
  } catch (error) {
    showToast(error.message, true);
    return;
  }
  const cityCount = config.cities.length;
  setLoading(
    true,
    liveWebSearch ? "Searching the web" : "Checking cached sources",
    liveWebSearch
      ? `${cityCount} ${cityCount === 1 ? "city" : "cities"} selected. This can take several minutes.`
      : "Ranking the saved source results."
  );
  try {
    const payload = await api("/api/check", {
      method: "POST",
      body: JSON.stringify({ config, live_web_search: liveWebSearch })
    });
    state.config = config;
    state.check = payload.check;
    render();
    $("#run-status").textContent = `${liveWebSearch ? "Live web search" : "Cached check"} · ${formatRunTime(payload.check.generated_at)}`;
    showToast(`${payload.check.summary.accepted} accepted offers found.`);
    document.body.classList.remove("settings-open");
  } catch (error) {
    showToast(error.message, true);
  } finally {
    setLoading(false);
  }
}

async function saveConfig() {
  try {
    const config = readForm();
    const payload = await api("/api/config", {
      method: "POST",
      body: JSON.stringify({ config })
    });
    state.config = clone(payload.config);
    $("#run-status").textContent = "Local settings saved";
    showToast("Saved to config.local.json.");
  } catch (error) {
    showToast(error.message, true);
  }
}

function render() {
  if (!state.check) return;
  const summary = state.check.summary;
  $("#accepted-count").textContent = summary.accepted;
  $("#candidate-count").textContent = summary.candidates;
  $("#summary-city-count").textContent = summary.cityCount;
  $("#window-count").textContent = summary.windowCount;
  $("#accepted-tab-count").textContent = summary.accepted;
  $("#all-tab-count").textContent = summary.candidates;
  $("#excluded-tab-count").textContent = summary.excluded;
  renderPriceLegend(state.config);
  renderSources();
  renderResults();
}

function renderSources() {
  const runs = state.check?.sources || [];
  $("#source-status").innerHTML = runs
    .map((source) => {
      const label = sourceLabels[source.name] || humanize(source.name);
      const detail = source.status === "error"
        ? `${label}: ${source.error}`
        : `${label} · ${source.candidateCount} checked · ${source.acceptedCount} accepted`;
      return `<span class="source-chip ${source.status}" title="${escapeAttr(detail)}">${escapeHtml(detail)}</span>`;
    })
    .join("");
}

function renderResults() {
  const allResults = state.check?.results || [];
  let results = allResults.filter((deal) => {
    if (state.view === "accepted" && !deal.accepted) return false;
    if (state.view === "excluded" && deal.accepted) return false;
    if (!state.search) return true;
    return [deal.listing_name, deal.city, deal.neighborhood, deal.source]
      .join(" ")
      .toLowerCase()
      .includes(state.search);
  });

  results = [...results].sort((a, b) => {
    if (state.sort === "price") return a.nightly_equivalent_eur - b.nightly_equivalent_eur;
    if (state.sort === "rating") return (b.rating || 0) / b.rating_scale - (a.rating || 0) / a.rating_scale;
    if (state.sort === "confidence") return b.confidence_score - a.confidence_score;
    return b.value_score - a.value_score;
  });

  if (results.length === 0) {
    const title = state.view === "accepted" ? "No accepted offers in this view" : "No matching candidates";
    const detail = state.search ? "Clear the result filter or adjust the search settings." : "Change the settings and check again.";
    renderEmpty(title, detail);
    return;
  }

  $("#results").innerHTML = results.map(renderDeal).join("");
  refreshIcons();
}

function renderDeal(deal) {
  const expanded = state.config && deal.nightly_equivalent_eur > state.config.price_penalty_threshold_eur;
  const source = sourceLabels[deal.source] || humanize(deal.source);
  const rating = deal.rating === null
    ? "Rating unknown"
    : `${deal.rating.toFixed(1)}/${deal.rating_scale} · ${formatNumber(deal.review_count || 0)} reviews`;
  const warnings = warningItems(deal);
  const amenities = Object.entries(deal.amenity_evidence)
    .map(([key, evidence]) => renderEvidence(amenityLabels[key] || humanize(key), evidence))
    .join("");
  const transit = renderEvidence("Transit", deal.transit_accessibility_evidence);
  const reasons = [...deal.why, ...deal.manual_verification]
    .map((item) => `<p>${escapeHtml(item)}</p>`)
    .join("");

  return `
    <article class="deal ${deal.accepted ? "accepted" : "excluded"}">
      <div class="deal-main">
        <div class="deal-identity">
          <div class="deal-kicker">
            <span class="status-label">${deal.accepted ? "Accepted" : "Excluded"}</span>
            <span>${escapeHtml(source)}</span>
          </div>
          <h2>${escapeHtml(deal.listing_name)}</h2>
          <p class="deal-location">${escapeHtml(deal.city)} · ${escapeHtml(deal.neighborhood || "Area not listed")}</p>
        </div>
        <div class="deal-facts">
          <div class="fact"><i data-lucide="calendar-days"></i><span>${escapeHtml(shortDates(deal.dates_tested))} · ${deal.stay_length} nights</span></div>
          <div class="fact"><i data-lucide="star"></i><span>${escapeHtml(rating)}</span></div>
        </div>
        <div class="deal-facts secondary-facts">
          <div class="fact"><i data-lucide="badge-euro"></i><span>€${deal.total_price_eur.toFixed(2)} total</span></div>
          <div class="fact"><i data-lucide="shield-check"></i><span>${Math.round(deal.confidence_score * 100)}% evidence confidence</span></div>
        </div>
        <div class="price-block">
          <strong class="${expanded ? "expanded-price" : ""}">€${deal.nightly_equivalent_eur.toFixed(0)}</strong>
          <span>per night</span>
        </div>
        <div class="score-block">
          <div class="score-line"><span>Value score</span><strong>${deal.value_score.toFixed(1)}</strong></div>
          <div class="score-track"><i style="width:${Math.max(0, Math.min(100, deal.value_score))}%"></i></div>
        </div>
      </div>
      ${warnings.length ? `<div class="deal-warning"><i data-lucide="triangle-alert"></i><span>${escapeHtml(warnings.join(" · "))}</span></div>` : ""}
      <details class="deal-details">
        <summary>Evidence and checks <i data-lucide="chevron-down"></i></summary>
        <div class="details-content">
          <div>
            <h3>Evidence</h3>
            <div class="evidence-list">${amenities}${transit}</div>
            <a class="source-link" href="${escapeAttr(deal.url)}" target="_blank" rel="noreferrer">
              Open ${escapeHtml(source)} <i data-lucide="external-link"></i>
            </a>
          </div>
          <div>
            <h3>${deal.accepted ? "Before booking" : "Why excluded"}</h3>
            <div class="reason-list">${reasons}</div>
          </div>
        </div>
      </details>
    </article>`;
}

function renderEvidence(label, evidence) {
  const icon = evidence.status === "confirmed"
    ? "circle-check"
    : evidence.status === "missing"
      ? "circle-x"
      : "circle-alert";
  return `
    <div class="evidence-item ${escapeAttr(evidence.status)}">
      <i data-lucide="${icon}"></i>
      <b>${escapeHtml(label)}</b>
      <span>${escapeHtml(evidence.detail)}</span>
    </div>`;
}

function warningItems(deal) {
  const warnings = [];
  const blackout = deal.amenity_evidence.blackout_window_covering;
  if (blackout && blackout.status !== "confirmed") warnings.push(`Blackout needs manual check: ${blackout.status}`);
  if (state.config && deal.nightly_equivalent_eur > state.config.price_penalty_threshold_eur) {
    warnings.push(`Expanded price band above €${state.config.price_penalty_threshold_eur}`);
  }
  if (deal.score_breakdown.unclear_fee_penalty > 0) warnings.push("Preliminary price; verify checkout total");
  return warnings;
}

function renderPriceLegend(config) {
  if (!config) return;
  $("#legend-preferred").textContent = config.preferred_nightly_price_eur;
  $("#legend-penalty").textContent = config.price_penalty_threshold_eur;
  $("#legend-max").textContent = config.max_nightly_price_eur;
}

function updateSelectionCounts() {
  const selected = $("#cities")?.querySelectorAll("input:checked").length || 0;
  const total = state.cityCatalog.length;
  $("#city-count").textContent = `${selected}/${total}`;
}

function updateLiveButton() {
  const selected = Array.from($("#sources")?.querySelectorAll("input:checked") || []).some(
    (input) => input.value === "websearch_cli"
  );
  $("#live-check").disabled = !selected;
  $("#live-check").title = selected ? "Refresh via Codex CLI web search" : "Enable Codex web search in Sources";
  $("#live-check-mobile").disabled = !selected;
  $("#live-check-mobile").title = $("#live-check").title;
}

function renderEmpty(title, detail) {
  $("#results").innerHTML = `
    <div class="empty-state">
      <div>
        <i data-lucide="search-x"></i>
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(detail)}</span>
      </div>
    </div>`;
  refreshIcons();
}

function setLoading(visible, title = "", detail = "") {
  $("#loading-overlay").hidden = !visible;
  if (visible) {
    $("#loading-title").textContent = title;
    $("#loading-detail").textContent = detail;
    refreshIcons();
  }
}

function showToast(message, error = false) {
  const toast = document.createElement("div");
  toast.className = `toast${error ? " error" : ""}`;
  toast.textContent = message;
  $("#toast-region").append(toast);
  window.setTimeout(() => toast.remove(), 4200);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}.`);
  return payload;
}

function refreshIcons() {
  window.lucide?.createIcons({ attrs: { "stroke-width": 1.8 } });
}

function numberValue(selector) {
  const value = Number($(selector).value);
  if (!Number.isFinite(value)) throw new Error(`${selector} must contain a number.`);
  return value;
}

function shortDates(value) {
  const [start, end] = value.split(" to ");
  return `${shortDate(start)} – ${shortDate(end)}`;
}

function shortDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

function formatRunTime(value) {
  return new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatNumber(value) {
  return new Intl.NumberFormat("en", { notation: value > 9999 ? "compact" : "standard" }).format(value);
}

function humanize(value) {
  return String(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
