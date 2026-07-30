import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  CircleGauge,
  Cloud,
  Compass,
  Database,
  ExternalLink,
  Heart,
  ListFilter,
  MapPin,
  Moon,
  RefreshCw,
  Save,
  Search,
  Settings2,
  Snowflake,
  Star,
  TrainFront,
  UtensilsCrossed,
  X,
  type LucideIcon
} from "lucide-react";
import { loadBootstrap, loadLocalConfig, runCheck, saveLocalConfig, saveServerConfig } from "./api";
import { createFallbackBootstrap, defaultConfig } from "./data";
import type {
  AppTab,
  BootstrapPayload,
  CheckPayload,
  Deal,
  Evidence,
  SourceCatalogItem,
  SourceRun,
  TravelConfig
} from "./types";

type Icon = LucideIcon;
type PriceBand = "all" | "preferred" | "strong" | "expanded";

const AMENITY_LABELS: Record<string, string> = {
  adjustable_climate_control: "Climate control",
  kitchen_or_kitchenette: "Kitchen",
  stovetop: "Stovetop",
  utensils: "Utensils",
  blackout_window_covering: "Blackout covering"
};

const AMENITY_ICONS: Record<string, Icon> = {
  adjustable_climate_control: Snowflake,
  kitchen_or_kitchenette: UtensilsCrossed,
  stovetop: UtensilsCrossed,
  utensils: UtensilsCrossed,
  blackout_window_covering: Moon
};

const SOURCE_LABELS: Record<string, string> = {
  booking_snapshot: "Booking",
  websearch_cli: "Web search",
  apartment_candidate_snapshot: "Hotels / Expedia",
  accor_snapshot: "Accor",
  serpapi_google_hotels: "Google Hotels",
  fixture: "Fixture"
};

export function App() {
  const fallback = useMemo(() => createFallbackBootstrap(loadLocalConfig()), []);
  const [bootstrap, setBootstrap] = useState<BootstrapPayload>(fallback);
  const [config, setConfig] = useState<TravelConfig>(fallback.config);
  const [check, setCheck] = useState<CheckPayload>(fallback.check);
  const [tab, setTab] = useState<AppTab>("explore");
  const [connection, setConnection] = useState<"loading" | "api" | "cached">("loading");
  const [busy, setBusy] = useState<"cached" | "live" | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);
  const [priceBand, setPriceBand] = useState<PriceBand>("all");
  const [city, setCity] = useState("All");
  const [search, setSearch] = useState("");
  const [savedIds, setSavedIds] = useState<string[]>(() => readSavedIds());
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadBootstrap().then(({ payload, cached }) => {
      if (!active) return;
      const localConfig = loadLocalConfig();
      setBootstrap(payload);
      setConfig(localConfig ?? payload.config);
      setCheck(payload.check);
      setConnection(cached ? "cached" : "api");
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const acceptedDeals = useMemo(() => check.results.filter((deal) => deal.accepted), [check]);
  const availableCities = useMemo(
    () => ["All", ...Array.from(new Set(acceptedDeals.map((deal) => deal.city))).sort()],
    [acceptedDeals]
  );
  const exploreDeals = useMemo(() => {
    const base = showExcluded ? check.results.filter((deal) => !deal.accepted) : acceptedDeals;
    return base
      .filter((deal) => city === "All" || deal.city === city)
      .filter((deal) => matchesPriceBand(deal, priceBand, config))
      .filter((deal) => {
        const query = search.trim().toLowerCase();
        return !query || `${deal.listing_name} ${deal.city} ${deal.neighborhood}`.toLowerCase().includes(query);
      })
      .sort((a, b) => b.value_score - a.value_score);
  }, [acceptedDeals, check.results, city, config, priceBand, search, showExcluded]);
  const savedDeals = useMemo(
    () => acceptedDeals.filter((deal) => savedIds.includes(dealId(deal))),
    [acceptedDeals, savedIds]
  );

  async function handleCheck(live: boolean) {
    setBusy(live ? "live" : "cached");
    try {
      const nextCheck = await runCheck(config, live);
      setCheck(nextCheck);
      setConnection("api");
      setTab("explore");
      setShowExcluded(false);
      setToast(`${nextCheck.summary.accepted} stays made the cut.`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "The checker could not be reached.");
      setConnection("cached");
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveSettings() {
    saveLocalConfig(config);
    try {
      await saveServerConfig(config);
      setToast("Settings saved here and to the checker.");
    } catch {
      setToast("Settings saved on this device.");
    }
  }

  function toggleSaved(deal: Deal) {
    const id = dealId(deal);
    setSavedIds((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      localStorage.setItem("travel-scout:saved", JSON.stringify(next));
      return next;
    });
  }

  function navigate(nextTab: AppTab) {
    setTab(nextTab);
    setSelectedDeal(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => navigate("explore")} aria-label="Travel Scout home">
          <span className="brand-mark"><Compass size={18} strokeWidth={2.4} /></span>
          <span>Travel Scout</span>
        </button>
        <button className="icon-button" type="button" onClick={() => navigate("settings")} aria-label="Open settings">
          <Settings2 size={20} />
        </button>
      </header>

      <main>
        {tab === "explore" && (
          <ExploreView
            check={check}
            config={config}
            connection={connection}
            busy={busy}
            deals={exploreDeals}
            cities={availableCities}
            city={city}
            setCity={setCity}
            search={search}
            setSearch={setSearch}
            priceBand={priceBand}
            setPriceBand={setPriceBand}
            showExcluded={showExcluded}
            setShowExcluded={setShowExcluded}
            savedIds={savedIds}
            onToggleSaved={toggleSaved}
            onSelect={setSelectedDeal}
            onShowSources={() => setShowSources(true)}
            onRefresh={() => void handleCheck(false)}
            onOpenSettings={() => navigate("settings")}
          />
        )}
        {tab === "saved" && (
          <SavedView
            deals={savedDeals}
            savedIds={savedIds}
            onToggleSaved={toggleSaved}
            onSelect={setSelectedDeal}
            onExplore={() => navigate("explore")}
          />
        )}
        {tab === "settings" && (
          <SettingsView
            config={config}
            defaultConfig={bootstrap.default_config ?? defaultConfig}
            sourceCatalog={bootstrap.source_catalog}
            busy={busy}
            onChange={setConfig}
            onBack={() => navigate("explore")}
            onSave={() => void handleSaveSettings()}
            onCheck={(live) => void handleCheck(live)}
          />
        )}
      </main>

      <nav className="bottom-nav" aria-label="Primary navigation">
        <NavButton active={tab === "explore"} icon={Compass} label="Explore" onClick={() => navigate("explore")} />
        <NavButton active={tab === "saved"} icon={Heart} label="Saved" count={savedIds.length} onClick={() => navigate("saved")} />
        <NavButton active={tab === "settings"} icon={Settings2} label="Settings" onClick={() => navigate("settings")} />
      </nav>

      {selectedDeal && (
        <DealSheet
          deal={selectedDeal}
          saved={savedIds.includes(dealId(selectedDeal))}
          onClose={() => setSelectedDeal(null)}
          onToggleSaved={() => toggleSaved(selectedDeal)}
        />
      )}
      {showSources && <SourceSheet sources={check.sources} onClose={() => setShowSources(false)} />}
      {busy && <LoadingOverlay live={busy === "live"} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

interface ExploreProps {
  check: CheckPayload;
  config: TravelConfig;
  connection: "loading" | "api" | "cached";
  busy: "cached" | "live" | null;
  deals: Deal[];
  cities: string[];
  city: string;
  setCity: (city: string) => void;
  search: string;
  setSearch: (search: string) => void;
  priceBand: PriceBand;
  setPriceBand: (band: PriceBand) => void;
  showExcluded: boolean;
  setShowExcluded: (show: boolean) => void;
  savedIds: string[];
  onToggleSaved: (deal: Deal) => void;
  onSelect: (deal: Deal) => void;
  onShowSources: () => void;
  onRefresh: () => void;
  onOpenSettings: () => void;
}

function ExploreView(props: ExploreProps) {
  const { check, config } = props;
  return (
    <>
      <section className="destination-hero">
        <img src="/travel-scout-city-morning.jpg" alt="European rooftops on a clear morning" />
        <div className="hero-shade" />
        <div className="hero-copy">
          <div className="eyebrow">{config.cities.length} cities · {Math.min(...config.stay_lengths)}–{Math.max(...config.stay_lengths)} nights</div>
          <h1>{check.summary.accepted} stays worth a look</h1>
          <p>Up to €{config.max_nightly_price_eur} per night</p>
        </div>
      </section>

      <section className="explore-content">
        <div className="run-strip">
          <button type="button" className={`connection ${props.connection}`} onClick={props.onShowSources}>
            {props.connection === "api" ? <Cloud size={16} /> : props.connection === "loading" ? <RefreshCw size={16} /> : <Database size={16} />}
            <span>{props.connection === "api" ? "Checker connected" : props.connection === "loading" ? "Connecting" : "Cached snapshot"}</span>
            <ChevronRight size={16} />
          </button>
          <button className="icon-button compact" type="button" onClick={props.onRefresh} disabled={Boolean(props.busy)} aria-label="Refresh cached deals">
            <RefreshCw size={18} />
          </button>
        </div>

        <div className="search-row">
          <Search size={18} />
          <input value={props.search} onChange={(event) => props.setSearch(event.target.value)} placeholder="City or stay" aria-label="Search stays" />
          {props.search && <button type="button" onClick={() => props.setSearch("")} aria-label="Clear search"><X size={16} /></button>}
        </div>

        <div className="horizontal-filters" aria-label="City filters">
          {props.cities.map((name) => (
            <button className={props.city === name ? "active" : ""} type="button" key={name} onClick={() => props.setCity(name)}>
              {name}
            </button>
          ))}
        </div>

        <div className="price-filter" aria-label="Price filter">
          <Segment active={props.priceBand === "all"} onClick={() => props.setPriceBand("all")}>All</Segment>
          <Segment active={props.priceBand === "preferred"} onClick={() => props.setPriceBand("preferred")}>≤ €{config.preferred_nightly_price_eur}</Segment>
          <Segment active={props.priceBand === "strong"} onClick={() => props.setPriceBand("strong")}>€{config.preferred_nightly_price_eur}–{config.price_penalty_threshold_eur}</Segment>
          <Segment active={props.priceBand === "expanded"} onClick={() => props.setPriceBand("expanded")}>€{config.price_penalty_threshold_eur}–{config.max_nightly_price_eur}</Segment>
        </div>

        <div className="section-heading">
          <div>
            <span className="eyebrow">{props.showExcluded ? "Ruled out" : "Best matches"}</span>
            <h2>{props.showExcluded ? `${check.summary.excluded} offers` : `${check.summary.accepted} stays`}</h2>
          </div>
          <button className="text-button" type="button" onClick={() => props.setShowExcluded(!props.showExcluded)}>
            <ListFilter size={17} />
            {props.showExcluded ? "Accepted" : `Excluded ${check.summary.excluded}`}
          </button>
        </div>

        {props.deals.length ? (
          <div className="deal-grid">
            {props.deals.map((deal) => (
              <DealCard
                key={dealId(deal)}
                deal={deal}
                saved={props.savedIds.includes(dealId(deal))}
                onToggleSaved={() => props.onToggleSaved(deal)}
                onSelect={() => props.onSelect(deal)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Compass}
            title="No stays in this view"
            action="Adjust search"
            onAction={props.onOpenSettings}
          />
        )}
      </section>
    </>
  );
}

function DealCard({ deal, saved, onToggleSaved, onSelect }: {
  deal: Deal;
  saved: boolean;
  onToggleSaved: () => void;
  onSelect: () => void;
}) {
  const warnings = dealWarnings(deal);
  return (
    <article className={`deal-card ${deal.accepted ? "" : "excluded"}`}>
      <button className="deal-main" type="button" onClick={onSelect}>
        <div className="deal-location">
          <span><MapPin size={14} /> {deal.city}</span>
          <span>{deal.neighborhood}</span>
        </div>
        <div className="deal-title-row">
          <h3>{deal.listing_name}</h3>
          <ChevronRight size={19} />
        </div>
        <div className="deal-facts">
          <span><Star size={15} fill="currentColor" /> {normalizeRating(deal).toFixed(1)} <small>({compactNumber(deal.review_count)})</small></span>
          <span><CalendarDays size={15} /> {shortDates(deal.dates_tested)} · {deal.stay_length}n</span>
          <span className="score"><CircleGauge size={15} /> {Math.round(deal.value_score)}</span>
        </div>
        {warnings.length > 0 && (
          <div className="warning-row">
            {warnings.slice(0, 2).map((warning) => <span key={warning}><AlertTriangle size={13} /> {warning}</span>)}
          </div>
        )}
        {!deal.accepted && (
          <div className="rejected-reason">{(deal.rejection_reasons ?? deal.why).at(0)}</div>
        )}
      </button>
      <div className="price-block">
        <strong>€{formatPrice(deal.nightly_equivalent_eur)}</strong>
        <span>per night</span>
        <small>€{formatPrice(deal.total_price_eur)} total</small>
      </div>
      {deal.accepted && (
        <button className={`save-button ${saved ? "saved" : ""}`} type="button" onClick={onToggleSaved} aria-label={saved ? "Remove from saved" : "Save stay"}>
          <Heart size={19} fill={saved ? "currentColor" : "none"} />
        </button>
      )}
    </article>
  );
}

function SavedView({ deals, savedIds, onToggleSaved, onSelect, onExplore }: {
  deals: Deal[];
  savedIds: string[];
  onToggleSaved: (deal: Deal) => void;
  onSelect: (deal: Deal) => void;
  onExplore: () => void;
}) {
  return (
    <section className="page-view">
      <div className="page-title">
        <span className="eyebrow">Shortlist</span>
        <h1>Saved stays</h1>
        <p>{deals.length ? `${deals.length} ${deals.length === 1 ? "place" : "places"} to compare` : "Keep the places that feel worth checking."}</p>
      </div>
      {deals.length ? (
        <div className="deal-grid">
          {deals.map((deal) => (
            <DealCard
              key={dealId(deal)}
              deal={deal}
              saved={savedIds.includes(dealId(deal))}
              onToggleSaved={() => onToggleSaved(deal)}
              onSelect={() => onSelect(deal)}
            />
          ))}
        </div>
      ) : (
        <EmptyState icon={Heart} title="Nothing saved yet" action="Explore stays" onAction={onExplore} />
      )}
    </section>
  );
}

function SettingsView({ config, defaultConfig, sourceCatalog, busy, onChange, onBack, onSave, onCheck }: {
  config: TravelConfig;
  defaultConfig: TravelConfig;
  sourceCatalog: SourceCatalogItem[];
  busy: "cached" | "live" | null;
  onChange: (config: TravelConfig) => void;
  onBack: () => void;
  onSave: () => void;
  onCheck: (live: boolean) => void;
}) {
  const setNumber = (key: keyof TravelConfig, value: number) => onChange({ ...config, [key]: value });
  return (
    <section className="settings-view">
      <div className="settings-header">
        <button className="icon-button" type="button" onClick={onBack} aria-label="Back to explore"><ArrowLeft size={20} /></button>
        <div>
          <span className="eyebrow">Search setup</span>
          <h1>Settings</h1>
        </div>
        <button className="text-button" type="button" onClick={() => onChange(structuredClone(defaultConfig))}>Reset</button>
      </div>

      <SettingsSection title="Nightly price">
        <div className="three-fields">
          <NumberField label="Preferred" prefix="€" value={config.preferred_nightly_price_eur} onChange={(value) => setNumber("preferred_nightly_price_eur", value)} />
          <NumberField label="Penalty after" prefix="€" value={config.price_penalty_threshold_eur} onChange={(value) => setNumber("price_penalty_threshold_eur", value)} />
          <NumberField label="Maximum" prefix="€" value={config.max_nightly_price_eur} onChange={(value) => setNumber("max_nightly_price_eur", value)} />
        </div>
        <div className="price-scale" aria-hidden="true">
          <span style={{ width: `${(config.preferred_nightly_price_eur / config.max_nightly_price_eur) * 100}%` }} />
          <span style={{ width: `${((config.price_penalty_threshold_eur - config.preferred_nightly_price_eur) / config.max_nightly_price_eur) * 100}%` }} />
          <span className="expanded" />
        </div>
      </SettingsSection>

      <SettingsSection title="Stay">
        <div className="choice-row">
          {[2, 3, 4, 5, 6].map((nights) => (
            <ToggleChip
              key={nights}
              active={config.stay_lengths.includes(nights)}
              onClick={() => onChange({ ...config, stay_lengths: toggleNumber(config.stay_lengths, nights) })}
            >
              {nights}n
            </ToggleChip>
          ))}
        </div>
        <div className="three-fields">
          <NumberField label="Start month" value={config.date_horizon.start_months_from_now} onChange={(value) => onChange({ ...config, date_horizon: { ...config.date_horizon, start_months_from_now: value } })} />
          <NumberField label="End month" value={config.date_horizon.end_months_from_now} onChange={(value) => onChange({ ...config, date_horizon: { ...config.date_horizon, end_months_from_now: value } })} />
          <NumberField label="Step days" value={config.date_horizon.step_days} onChange={(value) => onChange({ ...config, date_horizon: { ...config.date_horizon, step_days: value } })} />
        </div>
      </SettingsSection>

      <SettingsSection title="Cities">
        <div className="choice-row wrap">
          {defaultConfig.cities.map((city) => (
            <ToggleChip
              key={city.name}
              active={config.cities.some((item) => item.name === city.name)}
              onClick={() => {
                const selected = config.cities.some((item) => item.name === city.name);
                onChange({ ...config, cities: selected ? config.cities.filter((item) => item.name !== city.name) : [...config.cities, city] });
              }}
            >
              {city.name}
            </ToggleChip>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Quality">
        <div className="three-fields">
          <NumberField label="Rating /10" step={0.1} value={config.minimum_rating.ten_point} onChange={(value) => onChange({ ...config, minimum_rating: { ten_point: value, five_point: value / 2 } })} />
          <NumberField label="Reviews" value={config.minimum_review_count} onChange={(value) => setNumber("minimum_review_count", value)} />
          <NumberField label="Commute min" value={config.acceptable_transit.reasonable_commute_minutes} onChange={(value) => onChange({ ...config, acceptable_transit: { ...config.acceptable_transit, reasonable_commute_minutes: value } })} />
        </div>
        <SwitchRow
          label="Private accommodation only"
          checked={!config.allow_shared_rooms}
          onChange={(checked) => onChange({ ...config, allow_shared_rooms: !checked })}
        />
      </SettingsSection>

      <SettingsSection title="Must have">
        {Object.keys(AMENITY_LABELS).map((amenity) => (
          <SwitchRow
            key={amenity}
            label={AMENITY_LABELS[amenity]}
            note={config.manual_check_amenities.includes(amenity) ? "Warn when unclear" : undefined}
            checked={config.required_amenities.includes(amenity)}
            onChange={(checked) => onChange({
              ...config,
              required_amenities: checked
                ? Array.from(new Set([...config.required_amenities, amenity]))
                : config.required_amenities.filter((item) => item !== amenity),
              manual_check_amenities: checked
                ? config.manual_check_amenities
                : config.manual_check_amenities.filter((item) => item !== amenity)
            })}
          />
        ))}
      </SettingsSection>

      <SettingsSection title="Sources">
        {sourceCatalog.map((source) => (
          <SwitchRow
            key={source.id}
            label={source.label}
            note={source.kind}
            checked={config.sources_enabled.includes(source.id)}
            onChange={(checked) => onChange({
              ...config,
              sources_enabled: checked
                ? Array.from(new Set([...config.sources_enabled, source.id]))
                : config.sources_enabled.filter((item) => item !== source.id)
            })}
          />
        ))}
      </SettingsSection>

      <div className="settings-actions">
        <button className="secondary-button" type="button" onClick={onSave}><Save size={18} /> Save</button>
        <button className="primary-button" type="button" onClick={() => onCheck(false)} disabled={Boolean(busy)}><RefreshCw size={18} /> Check deals</button>
        <button className="quiet-button" type="button" onClick={() => onCheck(true)} disabled={Boolean(busy)}><Search size={18} /> Search web</button>
      </div>
    </section>
  );
}

function DealSheet({ deal, saved, onClose, onToggleSaved }: {
  deal: Deal;
  saved: boolean;
  onClose: () => void;
  onToggleSaved: () => void;
}) {
  return (
    <Sheet onClose={onClose} labelledBy="deal-sheet-title">
      <div className="sheet-handle" />
      <div className="sheet-topline">
        <span className="source-label">{SOURCE_LABELS[deal.source] ?? humanize(deal.source)}</span>
        <button className="icon-button compact" type="button" onClick={onClose} aria-label="Close details"><X size={19} /></button>
      </div>
      <div className="detail-title">
        <span><MapPin size={15} /> {deal.city} · {deal.neighborhood}</span>
        <h2 id="deal-sheet-title">{deal.listing_name}</h2>
      </div>
      <div className="detail-price">
        <div><strong>€{formatPrice(deal.nightly_equivalent_eur)}</strong><span>/ night</span></div>
        <small>€{formatPrice(deal.total_price_eur)} total · {deal.stay_length} nights</small>
      </div>
      <div className="detail-stats">
        <span><Star size={16} fill="currentColor" /><strong>{normalizeRating(deal).toFixed(1)}</strong><small>{compactNumber(deal.review_count)} reviews</small></span>
        <span><CircleGauge size={16} /><strong>{Math.round(deal.value_score)}</strong><small>value score</small></span>
        <span><CalendarDays size={16} /><strong>{shortDates(deal.dates_tested)}</strong><small>{deal.stay_length} nights</small></span>
      </div>

      {dealWarnings(deal).length > 0 && (
        <div className="detail-warnings">
          {dealWarnings(deal).map((warning) => <span key={warning}><AlertTriangle size={15} /> {warning}</span>)}
        </div>
      )}

      <DetailSection title="What is confirmed">
        <div className="evidence-list">
          {Object.entries(deal.amenity_evidence).map(([key, evidence]) => (
            <EvidenceRow key={key} icon={AMENITY_ICONS[key] ?? Check} label={AMENITY_LABELS[key] ?? humanize(key)} evidence={evidence} />
          ))}
          <EvidenceRow icon={TrainFront} label="Public transport" evidence={deal.transit_accessibility_evidence} />
        </div>
      </DetailSection>

      {deal.manual_verification.length > 0 && (
        <DetailSection title="Check before booking">
          <ul className="check-list">
            {deal.manual_verification.map((item) => <li key={item}><AlertTriangle size={15} /> <span>{item}</span></li>)}
          </ul>
        </DetailSection>
      )}

      {!deal.accepted && (
        <DetailSection title="Why it was ruled out">
          <ul className="check-list rejected">
            {(deal.rejection_reasons ?? deal.why).map((item) => <li key={item}><X size={15} /> <span>{item}</span></li>)}
          </ul>
        </DetailSection>
      )}

      <div className="sheet-actions">
        {deal.accepted && (
          <button className="secondary-button" type="button" onClick={onToggleSaved}>
            <Heart size={18} fill={saved ? "currentColor" : "none"} /> {saved ? "Saved" : "Save"}
          </button>
        )}
        <a className="primary-button" href={deal.url} target="_blank" rel="noreferrer">
          View source <ExternalLink size={17} />
        </a>
      </div>
    </Sheet>
  );
}

function SourceSheet({ sources, onClose }: { sources: SourceRun[]; onClose: () => void }) {
  return (
    <Sheet onClose={onClose} labelledBy="source-sheet-title">
      <div className="sheet-handle" />
      <div className="sheet-topline">
        <div>
          <span className="eyebrow">Latest check</span>
          <h2 id="source-sheet-title">Source status</h2>
        </div>
        <button className="icon-button compact" type="button" onClick={onClose} aria-label="Close source status"><X size={19} /></button>
      </div>
      <div className="source-list">
        {sources.map((source) => (
          <div className="source-item" key={source.name}>
            <span className={`source-state ${source.status}`}>{source.status === "error" ? <AlertTriangle size={16} /> : <Check size={16} />}</span>
            <div><strong>{SOURCE_LABELS[source.name] ?? humanize(source.name)}</strong><small>{source.error ?? `${source.candidateCount} checked · ${source.acceptedCount} accepted`}</small></div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

function Sheet({ children, onClose, labelledBy }: { children: React.ReactNode; onClose: () => void; labelledBy: string }) {
  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>{children}</section>
    </div>
  );
}

function LoadingOverlay({ live }: { live: boolean }) {
  return (
    <div className="loading-overlay" role="status">
      <div className="loading-panel">
        <RefreshCw className="spin" size={24} />
        <strong>{live ? "Searching the web" : "Checking deals"}</strong>
        <span>{live ? "This can take a few minutes." : "Ranking the saved sources."}</span>
      </div>
    </div>
  );
}

function EvidenceRow({ icon: IconComponent, label, evidence }: { icon: Icon; label: string; evidence: Evidence }) {
  return (
    <div className="evidence-row">
      <span className={`evidence-icon ${evidence.status}`}><IconComponent size={17} /></span>
      <div><strong>{label}</strong><small>{evidence.detail}</small></div>
      <span className={`evidence-status ${evidence.status}`}>{humanize(evidence.status)}</span>
    </div>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="settings-section"><h2>{title}</h2>{children}</section>;
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="detail-section"><h3>{title}</h3>{children}</section>;
}

function NumberField({ label, prefix, value, step = 1, onChange }: {
  label: string;
  prefix?: string;
  value: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <div>{prefix && <small>{prefix}</small>}<input type="number" value={value} step={step} onChange={(event) => onChange(Number(event.target.value))} /></div>
    </label>
  );
}

function SwitchRow({ label, note, checked, onChange }: { label: string; note?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="switch-row">
      <span><strong>{label}</strong>{note && <small>{note}</small>}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <i aria-hidden="true"><span /></i>
    </label>
  );
}

function ToggleChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button className={`toggle-chip ${active ? "active" : ""}`} type="button" onClick={onClick}>{active && <Check size={14} />}{children}</button>;
}

function Segment({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button className={active ? "active" : ""} type="button" onClick={onClick}>{children}</button>;
}

function NavButton({ active, icon: IconComponent, label, count, onClick }: { active: boolean; icon: Icon; label: string; count?: number; onClick: () => void }) {
  return (
    <button className={active ? "active" : ""} type="button" onClick={onClick}>
      <span><IconComponent size={21} fill={active && label === "Saved" ? "currentColor" : "none"} />{Boolean(count) && <i>{count}</i>}</span>
      {label}
    </button>
  );
}

function EmptyState({ icon: IconComponent, title, action, onAction }: { icon: Icon; title: string; action: string; onAction: () => void }) {
  return (
    <div className="empty-state">
      <span><IconComponent size={24} /></span>
      <h2>{title}</h2>
      <button className="secondary-button" type="button" onClick={onAction}>{action}</button>
    </div>
  );
}

function dealId(deal: Deal): string {
  return `${deal.url}|${deal.dates_tested}`;
}

function readSavedIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem("travel-scout:saved") ?? "[]") as string[];
  } catch {
    return [];
  }
}

function dealWarnings(deal: Deal): string[] {
  const warnings: string[] = [];
  if (deal.why.some((item) => /expanded .*band/i.test(item))) warnings.push("Expanded price band");
  if ((deal.score_breakdown.unclear_fee_penalty ?? 0) > 0 || deal.manual_verification.some((item) => /fee|tax|total price/i.test(item))) {
    warnings.push("Preliminary price");
  }
  if (deal.manual_verification.some((item) => /blackout|curtain|shutter/i.test(item))) warnings.push("Check blackout");
  return warnings;
}

function matchesPriceBand(deal: Deal, band: PriceBand, config: TravelConfig): boolean {
  const price = deal.nightly_equivalent_eur;
  if (band === "preferred") return price <= config.preferred_nightly_price_eur;
  if (band === "strong") return price > config.preferred_nightly_price_eur && price <= config.price_penalty_threshold_eur;
  if (band === "expanded") return price > config.price_penalty_threshold_eur && price <= config.max_nightly_price_eur;
  return true;
}

function toggleNumber(values: number[], value: number): number[] {
  const next = values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
  return next.sort((a, b) => a - b);
}

function normalizeRating(deal: Deal): number {
  return deal.rating_scale === 5 ? deal.rating * 2 : deal.rating;
}

function compactNumber(value: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatPrice(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(0);
}

function shortDates(value: string): string {
  const [start, end] = value.split(" to ");
  if (!start || !end) return value;
  const startDate = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);
  const first = startDate.toLocaleDateString("en", { month: "short", day: "numeric" });
  const second = endDate.toLocaleDateString("en", { month: startDate.getMonth() === endDate.getMonth() ? undefined : "short", day: "numeric" });
  return `${first}–${second}`;
}

function humanize(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
