"use client";

import { useEffect, useMemo, useState } from "react";

type Frequency = "hourly" | "daily" | "monthly" | "yearly";
type RecordRow = {
  location: string;
  start_date: string;
  end_date: string;
  visitation_count: number;
  frequency: string;
  source_file: string;
  source_sheet: string;
  target_processing: string;
};
type Prediction = {
  location: string;
  date: string;
  observed: number;
  predicted: number;
};
type IndexData = {
  locations: { name: string; frequencies: Frequency[] }[];
  best_models: Record<Frequency, { feature_set: string; model: string; rmse: number; mae: number; r2: number }>;
  edge_maps: Record<string, string>;
};
type FrequencyData = { frequency: Frequency; records: RecordRow[]; predictions: Prediction[] };
type Point = { date: Date; value: number };
type Series = { name: string; color: string; points: Point[]; dashed?: boolean };

const FREQUENCIES: Frequency[] = ["hourly", "daily", "monthly", "yearly"];
const COLORS = ["#147d64", "#d5782e", "#355e8a", "#8d5a97", "#9a7b25", "#b14850"];
const PAGE_SIZE = 50;

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function compactSeries(points: Point[], maximum = 500) {
  if (points.length <= maximum) return points;
  const bucket = points.length / maximum;
  return Array.from({ length: maximum }, (_, index) => {
    const start = Math.floor(index * bucket);
    const end = Math.max(start + 1, Math.floor((index + 1) * bucket));
    const slice = points.slice(start, end);
    return {
      date: slice[Math.floor(slice.length / 2)].date,
      value: slice.reduce((sum, point) => sum + point.value, 0) / slice.length,
    };
  });
}

function LineChart({ series, emptyText }: { series: Series[]; emptyText: string }) {
  const visible = series.filter((item) => item.points.length);
  if (!visible.length) return <div className="empty-chart">{emptyText}</div>;

  const width = 900;
  const height = 330;
  const pad = { left: 62, right: 22, top: 24, bottom: 44 };
  const points = visible.flatMap((item) => item.points);
  const minTime = Math.min(...points.map((point) => point.date.getTime()));
  const maxTime = Math.max(...points.map((point) => point.date.getTime()));
  const maxValue = Math.max(1, ...points.map((point) => point.value));
  const x = (date: Date) =>
    pad.left + ((date.getTime() - minTime) / Math.max(1, maxTime - minTime)) * (width - pad.left - pad.right);
  const y = (value: number) => height - pad.bottom - (value / maxValue) * (height - pad.top - pad.bottom);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const startLabel = new Date(minTime).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const endLabel = new Date(maxTime).toLocaleDateString("en-US", { month: "short", year: "numeric" });

  return (
    <>
      <div className="chart-legend">
        {visible.map((item) => (
          <span key={item.name}><i style={{ background: item.color }} />{item.name}</span>
        ))}
      </div>
      <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Time series chart">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y(maxValue * tick)} y2={y(maxValue * tick)} className="grid-line" />
            <text x={pad.left - 10} y={y(maxValue * tick) + 4} textAnchor="end" className="axis-label">
              {formatNumber(maxValue * tick)}
            </text>
          </g>
        ))}
        {visible.map((item) => {
          const chartPoints = compactSeries(item.points);
          const path = chartPoints.map((point, index) => `${index ? "L" : "M"}${x(point.date).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ");
          return <path key={item.name} d={path} fill="none" stroke={item.color} strokeWidth="2.25" strokeDasharray={item.dashed ? "7 5" : undefined} vectorEffect="non-scaling-stroke" />;
        })}
        <text x={pad.left} y={height - 12} className="axis-label">{startLabel}</text>
        <text x={width - pad.right} y={height - 12} textAnchor="end" className="axis-label">{endLabel}</text>
      </svg>
    </>
  );
}

export default function Home() {
  const [index, setIndex] = useState<IndexData | null>(null);
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [frequencyData, setFrequencyData] = useState<FrequencyData | null>(null);
  const [selectedTrails, setSelectedTrails] = useState<string[]>(["Elm Ridge"]);
  const [trailToAdd, setTrailToAdd] = useState("Elm Ridge");
  const [tableQuery, setTableQuery] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/data/index.json").then((response) => response.json()).then(setIndex);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/data/${frequency}.json`)
      .then((response) => response.json())
      .then((data) => { setFrequencyData(data); setLoading(false); setPage(0); });
  }, [frequency]);

  const availableTrails = useMemo(
    () => index?.locations.filter((location) => location.frequencies.includes(frequency)).map((location) => location.name) ?? [],
    [index, frequency],
  );

  useEffect(() => {
    const valid = selectedTrails.filter((trail) => availableTrails.includes(trail));
    if (availableTrails.length && !valid.length) valid.push(availableTrails[0]);
    if (valid.join("|") !== selectedTrails.join("|")) setSelectedTrails(valid);
    if (availableTrails.length && !availableTrails.includes(trailToAdd)) setTrailToAdd(availableTrails[0]);
  }, [availableTrails, selectedTrails, trailToAdd]);

  const selectedRecords = useMemo(() => {
    if (!frequencyData) return [];
    const selected = new Set(selectedTrails);
    return frequencyData.records.filter((row) => selected.has(row.location));
  }, [frequencyData, selectedTrails]);

  const filteredRecords = useMemo(() => {
    const query = tableQuery.trim().toLowerCase();
    if (!query) return selectedRecords;
    return selectedRecords.filter((row) =>
      `${row.start_date} ${row.source_file} ${row.source_sheet} ${row.target_processing}`.toLowerCase().includes(query)
    );
  }, [selectedRecords, tableQuery]);

  const selectedPredictions = useMemo(() => {
    const selected = new Set(selectedTrails);
    return frequencyData?.predictions.filter((row) => selected.has(row.location)) ?? [];
  }, [frequencyData, selectedTrails]);

  const observedSeries = useMemo<Series[]>(() =>
    selectedTrails.map((trail, index) => ({
      name: trail,
      color: COLORS[index % COLORS.length],
      points: selectedRecords.filter((row) => row.location === trail)
        .map((row) => ({ date: new Date(row.start_date), value: Number(row.visitation_count) }))
        .sort((a, b) => a.date.getTime() - b.date.getTime()),
    })), [selectedRecords, selectedTrails]);

  const predictionSeries = useMemo<Series[]>(() =>
    selectedTrails.flatMap((trail, index) => {
      const rows = selectedPredictions.filter((row) => row.location === trail).sort((a, b) => a.date.localeCompare(b.date));
      return [
        { name: `${trail} observed`, color: COLORS[index % COLORS.length], points: rows.map((row) => ({ date: new Date(row.date), value: row.observed })) },
        { name: `${trail} predicted`, color: COLORS[index % COLORS.length], dashed: true, points: rows.map((row) => ({ date: new Date(row.date), value: row.predicted })) },
      ];
    }), [selectedPredictions, selectedTrails]);

  const totalVisitors = selectedRecords.reduce((sum, row) => sum + Number(row.visitation_count || 0), 0);
  const dates = selectedRecords.map((row) => new Date(row.start_date).getTime()).filter(Number.isFinite);
  const model = index?.best_models[frequency];
  const mappedTrails = selectedTrails.filter((trail) => index?.edge_maps[trail]);
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const tableRows = filteredRecords.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function addTrail() {
    if (trailToAdd && !selectedTrails.includes(trailToAdd)) setSelectedTrails([...selectedTrails, trailToAdd]);
  }

  return (
    <main>
      <header className="topbar">
        <div className="brand-mark">DEC</div>
        <div><strong>Trail Visitation Explorer</strong><span>Decision support workspace</span></div>
        <div className="data-status"><i /> Cleaned records · model outputs</div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">Catskill trail monitoring</p>
          <h1>Strava &amp; Trail Register Dashboard</h1>
          <p>Compare one trail or a working set, inspect source records, and review held-out visitation estimates alongside Strava edge context.</p>
        </div>
        <div className="hero-note"><span>Current view</span><strong>{selectedTrails.length} trail{selectedTrails.length === 1 ? "" : "s"} · {frequency}</strong></div>
      </section>

      <section className="control-panel" aria-label="Trail and frequency controls">
        <div className="control-group frequency-control">
          <label>Time frequency</label>
          <div className="segmented">
            {FREQUENCIES.map((item) => <button key={item} className={frequency === item ? "active" : ""} onClick={() => setFrequency(item)}>{item}</button>)}
          </div>
        </div>
        <div className="control-group trail-control">
          <label htmlFor="trail-select">Add trail</label>
          <div className="select-row">
            <select id="trail-select" value={trailToAdd} onChange={(event) => setTrailToAdd(event.target.value)}>
              {availableTrails.map((trail) => <option key={trail}>{trail}</option>)}
            </select>
            <button onClick={addTrail} disabled={!trailToAdd || selectedTrails.includes(trailToAdd)}>Add</button>
          </div>
        </div>
        <div className="trail-chips" aria-label="Selected trails">
          {selectedTrails.map((trail) => (
            <button key={trail} onClick={() => selectedTrails.length > 1 && setSelectedTrails(selectedTrails.filter((item) => item !== trail))}>
              {trail}<span aria-hidden="true">{selectedTrails.length > 1 ? "×" : "•"}</span>
            </button>
          ))}
        </div>
      </section>

      {loading || !index || !frequencyData ? <div className="loading">Loading {frequency} records…</div> : (
        <>
          <section className="metrics">
            <article><span>Records in view</span><strong>{selectedRecords.length.toLocaleString()}</strong><small>{selectedTrails.length} selected trail{selectedTrails.length === 1 ? "" : "s"}</small></article>
            <article><span>Recorded visitation</span><strong>{formatNumber(totalVisitors)}</strong><small>Sum of displayed observations</small></article>
            <article><span>Date coverage</span><strong>{dates.length ? new Date(Math.min(...dates)).getFullYear() : "—"}–{dates.length ? new Date(Math.max(...dates)).getFullYear() : "—"}</strong><small>{frequency} reporting periods</small></article>
            <article><span>Best held-out model</span><strong className="model-name">{model?.model ?? "Unavailable"}</strong><small>{model ? `R² ${model.r2.toFixed(2)} · RMSE ${formatNumber(model.rmse)}` : "No saved result"}</small></article>
          </section>

          <section className="dashboard-grid">
            <article className="panel wide">
              <div className="panel-heading"><div><p className="section-number">01 / OBSERVED</p><h2>Visitation over time</h2></div><span>{frequency} records</span></div>
              <LineChart series={observedSeries} emptyText="No observed records are available for this selection." />
            </article>

            <article className="panel wide">
              <div className="panel-heading"><div><p className="section-number">02 / MODEL CHECK</p><h2>Observed & predicted</h2></div><span>Held-out periods only</span></div>
              <LineChart series={predictionSeries} emptyText="No held-out predictions are available for these trails and this frequency." />
              {model && <p className="model-caption">Using {model.feature_set} · {model.model}. Predictions are evaluation-period estimates, not a live forecast.</p>}
            </article>

            <article className="panel edge-panel">
              <div className="panel-heading"><div><p className="section-number">03 / STRAVA CONTEXT</p><h2>Relevant edge map</h2></div><span>Training-selected edges</span></div>
              {mappedTrails.length ? mappedTrails.map((trail) => (
                <figure key={trail}>
                  <img src={index.edge_maps[trail]} alt={`Relevant Strava edges around ${trail}`} />
                  <figcaption>{trail} · local network with visitation-relevant edges highlighted</figcaption>
                </figure>
              )) : <div className="map-empty"><strong>No saved edge map for this selection</strong><p>Edge geometry has currently been prepared for Elm Ridge. The records and prediction views remain available for all modeled trails.</p></div>}
            </article>

            <article className="panel records-panel">
              <div className="panel-heading">
                <div><p className="section-number">04 / SOURCE RECORDS</p><h2>Cleaned visitation records</h2></div>
                <input aria-label="Filter records" placeholder="Filter source or date…" value={tableQuery} onChange={(event) => { setTableQuery(event.target.value); setPage(0); }} />
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Trail</th><th>Start</th><th>End</th><th>Visitors</th><th>Frequency</th><th>Source</th><th>Processing</th></tr></thead>
                  <tbody>{tableRows.map((row, index) => (
                    <tr key={`${row.location}-${row.start_date}-${index}`}><td><strong>{row.location}</strong></td><td>{row.start_date}</td><td>{row.end_date}</td><td className="number">{formatNumber(row.visitation_count)}</td><td><span className="frequency-pill">{row.frequency}</span></td><td>{row.source_file}<small>{row.source_sheet}</small></td><td>{row.target_processing}</td></tr>
                  ))}</tbody>
                </table>
              </div>
              <div className="pagination"><span>Page {page + 1} of {totalPages} · {filteredRecords.length.toLocaleString()} matching records</span><div><button disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><button disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>Next</button></div></div>
            </article>
          </section>
        </>
      )}
      <footer><strong>New York State DEC</strong><span>Visitation records are reconciled across source files; review provenance before operational use.</span></footer>
    </main>
  );
}
