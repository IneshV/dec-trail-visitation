from __future__ import annotations

import csv
import json
from collections import defaultdict
from pathlib import Path


APP_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = APP_ROOT.parent
DATA_ROOT = PROJECT_ROOT / "data"
PUBLIC_DATA = APP_ROOT / "public" / "data"
PUBLIC_DATA.mkdir(parents=True, exist_ok=True)

FREQUENCIES = ("hourly", "daily", "monthly", "yearly")
RECORD_FIELDS = (
    "location",
    "start_date",
    "end_date",
    "visitation_count",
    "frequency",
    "source_file",
    "source_sheet",
    "target_processing",
)


def numeric(value: str):
    try:
        number = float(value)
        return int(number) if number.is_integer() else round(number, 4)
    except (TypeError, ValueError):
        return None


best_models: dict[str, dict] = {}
with (DATA_ROOT / "ml_outputs" / "strava_enhanced_model_results.csv").open(
    newline="", encoding="utf-8-sig"
) as handle:
    for row in csv.DictReader(handle):
        frequency = row["frequency"]
        rmse = numeric(row["RMSE"])
        if rmse is None:
            continue
        if frequency not in best_models or rmse < best_models[frequency]["rmse"]:
            best_models[frequency] = {
                "feature_set": row["feature_set"],
                "model": row["model"],
                "rmse": rmse,
                "mae": numeric(row["MAE"]),
                "r2": numeric(row["R2"]),
            }

predictions: dict[str, list[dict]] = defaultdict(list)
prediction_path = DATA_ROOT / "ml_outputs" / "strava_enhanced_test_predictions.csv"
with prediction_path.open(newline="", encoding="utf-8-sig") as handle:
    for row in csv.DictReader(handle):
        best = best_models.get(row["frequency"])
        if not best:
            continue
        if row["feature_set"] != best["feature_set"] or row["model"] != best["model"]:
            continue
        predictions[row["frequency"]].append(
            {
                "location": row["location"],
                "date": row["start_date"],
                "observed": numeric(row["observed"]),
                "predicted": numeric(row["predicted"]),
            }
        )

records: dict[str, list[dict]] = {}
location_frequencies: dict[str, set[str]] = defaultdict(set)
for frequency in FREQUENCIES:
    rows = []
    with (DATA_ROOT / f"{frequency}.csv").open(
        newline="", encoding="utf-8-sig"
    ) as handle:
        for row in csv.DictReader(handle):
            compact = {field: row.get(field, "") for field in RECORD_FIELDS}
            compact["visitation_count"] = numeric(compact["visitation_count"])
            rows.append(compact)
            location_frequencies[compact["location"]].add(frequency)
    records[frequency] = rows

index_payload = {
    "generated_from": "Final_CSC_Workspace/data",
    "frequencies": list(FREQUENCIES),
    "locations": [
        {"name": name, "frequencies": sorted(values)}
        for name, values in sorted(location_frequencies.items())
    ],
    "best_models": best_models,
    "edge_maps": {
        "Elm Ridge": "/data/elm_ridge_relevant_edges_geographic_heatmap.png"
    },
}

index_output = PUBLIC_DATA / "index.json"
index_output.write_text(
    json.dumps(index_payload, separators=(",", ":")), encoding="utf-8"
)
print(f"Wrote {index_output}")

for frequency in FREQUENCIES:
    output = PUBLIC_DATA / f"{frequency}.json"
    output.write_text(
        json.dumps(
            {
                "frequency": frequency,
                "records": records[frequency],
                "predictions": predictions.get(frequency, []),
            },
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )
    print(f"Wrote {output} ({output.stat().st_size / 1_000_000:.1f} MB)")
