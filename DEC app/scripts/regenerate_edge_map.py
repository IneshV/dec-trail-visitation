"""Rebuild the saved Elm Ridge edge map without an inferred trailhead marker."""

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import Normalize
import numpy as np
import shapefile


APP_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = APP_ROOT.parent
OUTPUTS = PROJECT_ROOT / "data" / "ml_outputs"
APP_OUTPUT = APP_ROOT / "public" / "data" / "elm_ridge_relevant_edges_geographic_heatmap.png"

# Training-only local edge scores displayed by the final notebook cell.
EDGE_SCORES = {
    514762148: 0.614612,
    514762310: 0.612138,
    514762308: 0.608919,
    514762309: 0.604370,
    514762311: 0.600440,
    514762298: 0.587816,
    514762294: 0.583345,
    514762290: 0.582726,
    514762296: 0.580770,
    514762295: 0.575292,
    514768654: 0.518917,
    514768656: 0.492458,
    514768670: 0.480497,
    514768672: 0.478702,
    514768674: 0.475935,
}


def plot_shape(ax, shape, **kwargs):
    parts = list(shape.parts) + [len(shape.points)]
    for start, end in zip(parts[:-1], parts[1:]):
        points = np.asarray(shape.points[start:end], dtype=float)
        if len(points):
            ax.plot(points[:, 0], points[:, 1], **kwargs)


shape_file = sorted((PROJECT_ROOT / "State_model" / "daily").glob("*/*.shp"))[0]
reader = shapefile.Reader(str(shape_file))
selected = {}
for index, record in enumerate(reader.iterRecords(fields=["edgeUID"])):
    edge_uid = int(record[0])
    if edge_uid in EDGE_SCORES:
        selected[edge_uid] = reader.shape(index)
        if len(selected) == len(EDGE_SCORES):
            break

if len(selected) != len(EDGE_SCORES):
    missing = sorted(set(EDGE_SCORES) - set(selected))
    raise RuntimeError(f"Missing edge geometry: {missing}")

points = np.concatenate(
    [np.asarray(shape.points, dtype=float) for shape in selected.values()]
)
longitude_pad = max(0.018, np.ptp(points[:, 0]) * 0.18)
latitude_pad = max(0.018, np.ptp(points[:, 1]) * 0.18)
bounds = (
    float(points[:, 0].min() - longitude_pad),
    float(points[:, 1].min() - latitude_pad),
    float(points[:, 0].max() + longitude_pad),
    float(points[:, 1].max() + latitude_pad),
)
background = [
    shape_record.shape
    for shape_record in reader.iterShapeRecords(fields=["edgeUID"], bbox=bounds)
]

score_min, score_max = min(EDGE_SCORES.values()), max(EDGE_SCORES.values())
normalizer = Normalize(vmin=score_min, vmax=score_max)
color_map = plt.get_cmap("inferno")
fig, ax = plt.subplots(figsize=(10, 8))
for shape in background:
    plot_shape(ax, shape, color="#6f7782", linewidth=0.25, alpha=0.18, zorder=1)
for edge_uid, score in sorted(EDGE_SCORES.items(), key=lambda item: item[1]):
    plot_shape(
        ax,
        selected[edge_uid],
        color=color_map(normalizer(score)),
        linewidth=2.3,
        alpha=0.95,
        zorder=3,
    )

ax.set_xlim(bounds[0], bounds[2])
ax.set_ylim(bounds[1], bounds[3])
ax.set_aspect("equal", adjustable="box")
ax.set_title("Elm Ridge\n15 visitation-relevant Strava edges")
ax.set_axis_off()
colorbar = fig.colorbar(
    plt.cm.ScalarMappable(norm=normalizer, cmap=color_map), ax=ax, pad=0.02
)
colorbar.set_label("Edge relevance score (absolute Pearson/Spearman average)")
fig.tight_layout()
for output in (
    OUTPUTS / "elm_ridge_relevant_edges_geographic_heatmap.png",
    APP_OUTPUT,
):
    fig.savefig(output, dpi=170, bbox_inches="tight")
plt.close(fig)
print(f"Wrote star-free edge map to {APP_OUTPUT}")
