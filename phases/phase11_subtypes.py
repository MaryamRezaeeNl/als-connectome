"""
Phase 11 -- Disease Subtype Identification
PCA + K-means clustering on top-20 critical configs from Phase 10.
Features: tipping_step, plateau, boundary_slope, boundary_intercept,
          aggregationAmplification.
Simple aggAmp threshold classifier to predict cluster membership.
"""

import json, math, sys
import numpy as np

# ── stdlib-only helpers (no sklearn guard needed at top level) ────────────────

def _to_py(obj):
    if isinstance(obj, dict):  return {k: _to_py(v) for k, v in obj.items()}
    if isinstance(obj, list):  return [_to_py(v) for v in obj]
    if isinstance(obj, (np.integer,)):  return int(obj)
    if isinstance(obj, (np.floating,)): return float(obj)
    if isinstance(obj, (np.bool_,)):    return bool(obj)
    if isinstance(obj, float) and math.isnan(obj): return None
    return obj

def _nanmean(vals):
    v = [x for x in vals if x is not None and not (isinstance(x, float) and math.isnan(x))]
    return float(np.mean(v)) if v else None

# ── Load data ────────────────────────────────────────────────────────────────

print("Phase 11 -- Disease Subtype Identification")
print("=" * 60)

p10 = json.load(open("results/phase10_boundary_robustness.json", encoding="utf-8"))
rm  = json.load(open("results/regime_map.json", encoding="utf-8"))

rm_by_id = {c["id"]: c for c in rm["configs"]}

# ── Feature extraction ───────────────────────────────────────────────────────

FEAT_COLS = [
    "tipping_step",
    "plateau",
    "boundary_slope",
    "boundary_intercept",
    "aggregationAmplification",
]

records = []
p10_by_id = {}
for cr in p10["config_results"]:
    cid  = cr["config_id"]
    p10_by_id[cid] = cr
    tip  = cr["baseline_tip"]
    bnd  = cr["boundary"]
    slope = bnd["slope"]
    intcp = bnd["intercept"]

    rm_e    = rm_by_id.get(cid, {})
    params  = rm_e.get("params", {})
    agg_amp = params.get("aggregationAmplification", float("nan"))
    plateau = float(rm_e.get("alive_at_500", float("nan")))

    records.append({
        "config_id":            cid,
        "tipping_step":         float(tip),
        "plateau":              plateau,
        "boundary_slope":       float(slope),
        "boundary_intercept":   float(intcp),
        "aggregationAmplification": float(agg_amp),
    })

print(f"Loaded {len(records)} configs for clustering")
config_ids = [r["config_id"] for r in records]

# ── Build feature matrix ─────────────────────────────────────────────────────

X_raw = np.array([[r[f] for f in FEAT_COLS] for r in records], dtype=float)

# Replace any NaN with column mean (shouldn't occur but just in case)
col_means = np.nanmean(X_raw, axis=0)
for j in range(X_raw.shape[1]):
    nan_mask = np.isnan(X_raw[:, j])
    X_raw[nan_mask, j] = col_means[j]

# Standardise (zero mean, unit variance)
mu  = X_raw.mean(axis=0)
std = X_raw.std(axis=0, ddof=0)
std[std == 0] = 1.0
X   = (X_raw - mu) / std

print(f"Feature matrix: {X.shape[0]} x {X.shape[1]}")

# ── PCA ─────────────────────────────────────────────────────────────────────

def pca_2d(X):
    cov  = np.cov(X.T)
    vals, vecs = np.linalg.eigh(cov)
    order = np.argsort(vals)[::-1]
    vals  = vals[order]
    vecs  = vecs[:, order]
    total = vals.sum()
    explained = (vals / total).tolist() if total > 0 else [0.0] * len(vals)
    X_pca = X @ vecs[:, :2]
    loadings = vecs[:, :2].T.tolist()   # shape (2, n_feats)
    return X_pca, explained, loadings

X_pca, explained, loadings = pca_2d(X)
print(f"PCA PC1={explained[0]:.1%}  PC2={explained[1]:.1%}  "
      f"cumulative={sum(explained[:2]):.1%}")

# ── K-means ──────────────────────────────────────────────────────────────────

def kmeans(X, k, n_init=50, seed=42):
    rng   = np.random.default_rng(seed)
    best_labels, best_inertia = None, np.inf
    n = X.shape[0]
    for _ in range(n_init):
        idx       = rng.choice(n, k, replace=False)
        centroids = X[idx].copy()
        for _iter in range(300):
            dists  = np.linalg.norm(X[:, None, :] - centroids[None, :, :], axis=2)
            labels = dists.argmin(axis=1)
            new_c  = np.array([
                X[labels == c].mean(axis=0) if (labels == c).any()
                else centroids[c]
                for c in range(k)
            ])
            if np.allclose(new_c, centroids, atol=1e-8):
                break
            centroids = new_c
        inertia = sum(
            np.linalg.norm(X[i] - centroids[labels[i]]) ** 2
            for i in range(n)
        )
        if inertia < best_inertia:
            best_inertia = inertia
            best_labels  = labels.copy()
    return best_labels

def silhouette(X, labels):
    n   = X.shape[0]
    uniq = np.unique(labels)
    if len(uniq) < 2:
        return -1.0
    scores = []
    for i in range(n):
        same  = X[labels == labels[i]]
        a     = np.mean(np.linalg.norm(same - X[i], axis=1)) if len(same) > 1 else 0.0
        b_vals = []
        for c in uniq:
            if c == labels[i]:
                continue
            other = X[labels == c]
            b_vals.append(np.mean(np.linalg.norm(other - X[i], axis=1)))
        b = min(b_vals) if b_vals else 0.0
        scores.append((b - a) / max(a, b) if max(a, b) > 0 else 0.0)
    return float(np.mean(scores))

sil_scores   = {}
labels_by_k  = {}
for k in [2, 3, 4]:
    lbls          = kmeans(X, k)
    s             = silhouette(X, lbls)
    sil_scores[k] = round(s, 4)
    labels_by_k[k] = lbls.tolist()
    print(f"  k={k}  silhouette={s:.4f}  "
          f"sizes={[int((lbls==c).sum()) for c in range(k)]}")

best_k      = max(sil_scores, key=sil_scores.get)
best_labels = np.array(labels_by_k[best_k])
print(f"Best k={best_k}  (silhouette={sil_scores[best_k]:.4f})")

# ── Cluster characterisation ─────────────────────────────────────────────────

cluster_info = []
for c in range(best_k):
    mask    = best_labels == c
    members = [records[i] for i in range(len(records)) if mask[i]]
    cids    = [m["config_id"] for m in members]

    mean_feats = {f: _nanmean([m[f] for m in members]) for f in FEAT_COLS}

    # therapy window metrics from phase10
    min_str_vals, max_t_vals, prev_flags = [], [], []
    for cid in cids:
        bnd = p10_by_id[cid]["boundary"]
        ms  = bnd.get("min_strength_prev")
        mt  = bnd.get("max_start_t_any")
        if ms is not None:
            min_str_vals.append(float(ms))
        if mt is not None:
            max_t_vals.append(float(mt))
        prev_flags.append(1.0 if ms is not None else 0.0)

    cluster_info.append({
        "cluster":              c,
        "n":                    int(mask.sum()),
        "config_ids":           cids,
        "mean_features":        mean_feats,
        "mean_min_strength_prev": _nanmean(min_str_vals) if min_str_vals else None,
        "mean_max_start_t_any":   _nanmean(max_t_vals)  if max_t_vals  else None,
        "prevention_rate":      float(np.mean(prev_flags)),
    })
    print(f"  Cluster {c} (n={int(mask.sum())}): "
          f"aggAmp={mean_feats['aggregationAmplification']:.3f}  "
          f"slope={mean_feats['boundary_slope']:.0f}  "
          f"plateau={mean_feats['plateau']:.1f}  "
          f"tip={mean_feats['tipping_step']:.0f}")

# ── aggAmp threshold classifier ──────────────────────────────────────────────
# Strategy: for any k, find centroids of aggAmp per cluster, assign each
# point to nearest centroid. Best threshold(s) maximise accuracy.

agg_vals = X_raw[:, FEAT_COLS.index("aggregationAmplification")]

# Compute per-cluster aggAmp centroids then assign by nearest centroid
cluster_agg_means = np.array([
    agg_vals[best_labels == c].mean() for c in range(best_k)
])

def predict_by_centroid(vals, centroids):
    dists  = np.abs(vals[:, None] - centroids[None, :])
    return dists.argmin(axis=1)

pred_labels = predict_by_centroid(agg_vals, cluster_agg_means)
# Labels may be permuted -- find best permutation of predicted vs actual
from itertools import permutations as _perms

def best_perm_acc(true_lbls, pred_lbls, k):
    best = 0.0
    for perm in _perms(range(k)):
        mapped = np.array([perm[p] for p in pred_lbls])
        acc    = float(np.mean(mapped == true_lbls))
        if acc > best:
            best = acc
    return best

clf_accuracy = best_perm_acc(best_labels, pred_labels, best_k)

# Pearson r between aggAmp and cluster label (informative for any k)
agg_cluster_r = float(np.corrcoef(agg_vals, best_labels)[0, 1])

# For k=2 also find single threshold
if best_k == 2:
    thresholds    = np.unique(agg_vals)
    best_thr      = None
    best_thr_acc  = 0.0
    for thr in thresholds:
        for flip in [0, 1]:
            pred  = ((agg_vals >= thr).astype(int) + flip) % 2
            acc   = float(np.mean(pred == best_labels))
            if acc > best_thr_acc:
                best_thr_acc = acc
                best_thr     = float(thr)
    threshold_info = {"threshold": best_thr, "accuracy": best_thr_acc}
else:
    threshold_info = {"centroids": cluster_agg_means.tolist(),
                      "centroid_accuracy": clf_accuracy}

print(f"aggAmp classifier accuracy: {clf_accuracy:.1%}  "
      f"(Pearson r={agg_cluster_r:.3f})")

# ── Build result dict ────────────────────────────────────────────────────────

result = {
    "description": "Phase 11 disease subtype identification",
    "n_configs":   len(records),
    "features":    FEAT_COLS,
    "pca": {
        "explained_variance_ratio": explained[:2],
        "cumulative_2pc":           sum(explained[:2]),
        "loadings_pc1":             {FEAT_COLS[j]: loadings[0][j] for j in range(len(FEAT_COLS))},
        "loadings_pc2":             {FEAT_COLS[j]: loadings[1][j] for j in range(len(FEAT_COLS))},
        "scores":                   X_pca.tolist(),
    },
    "kmeans": {
        "silhouette_scores": sil_scores,
        "best_k":            best_k,
        "best_silhouette":   sil_scores[best_k],
        "labels_by_k":       labels_by_k,
    },
    "clusters":  cluster_info,
    "classifier": {
        "feature":        "aggregationAmplification",
        "accuracy":       clf_accuracy,
        "pearson_r":      agg_cluster_r,
        "threshold_info": threshold_info,
    },
    "config_ids": config_ids,
}

result = _to_py(result)

with open("results/phase11_subtypes.json", "w", encoding="utf-8") as f:
    json.dump(result, f, indent=2)
print("Saved -> results/phase11_subtypes.json")

# ── Report ───────────────────────────────────────────────────────────────────

def build_report(result):
    pca_r   = result["pca"]
    km_r    = result["kmeans"]
    clus    = result["clusters"]
    clf     = result["classifier"]
    best_k  = km_r["best_k"]

    # silhouette table
    sil_rows = "\n".join(
        f"  k={k}: silhouette={km_r['silhouette_scores'][k]:.4f}"
        + ("  <-- best" if k == best_k else "")
        for k in [2, 3, 4]
    )

    # PCA loadings (PC1)
    pc1 = pca_r["loadings_pc1"]
    load_rows = "\n".join(
        f"  {feat:<30s} {pc1[feat]:+.3f}"
        for feat in sorted(pc1, key=lambda x: abs(pc1[x]), reverse=True)
    )

    # Per-cluster characterisation
    clus_rows = []
    for c_info in sorted(clus, key=lambda x: x["cluster"]):
        c   = c_info["cluster"]
        mf  = c_info["mean_features"]
        ms  = c_info["mean_min_strength_prev"]
        mt  = c_info["mean_max_start_t_any"]
        pr  = c_info["prevention_rate"]
        ids_str = ", ".join(str(x) for x in sorted(c_info["config_ids"]))
        mt_days = f"{mt * 2.25:.0f}" if mt is not None else "n/a"
        ms_str  = f"{ms:.2f}" if ms is not None else "n/a"
        clus_rows.append(
            f"### Cluster {c}  (n={c_info['n']})\n"
            f"  Config IDs:              {ids_str}\n"
            f"  Mean tipping step:       {mf['tipping_step']:.0f}\n"
            f"  Mean plateau (alive):    {mf['plateau']:.1f} / 61\n"
            f"  Mean boundary slope:     {mf['boundary_slope']:.0f}\n"
            f"  Mean boundary intercept: {mf['boundary_intercept']:.0f}\n"
            f"  Mean aggAmp:             {mf['aggregationAmplification']:.3f}\n"
            f"  Therapy: min strength    {ms_str}  "
            f"max start t={mt:.0f} (~{mt_days} days)" if mt is not None else
            f"  Therapy: min strength    {ms_str}  max start t=n/a"
        )
        clus_rows.append(f"  Prevention rate:         {pr:.0%}\n")

    clf_acc  = clf["accuracy"]
    clf_r    = clf["pearson_r"]
    thr_info = clf["threshold_info"]
    if "threshold" in thr_info:
        clf_detail = (f"  Single threshold: aggAmp >= {thr_info['threshold']:.3f}\n"
                      f"  Threshold accuracy: {thr_info['accuracy']:.1%}")
    else:
        cents = thr_info["centroids"]
        clf_detail = (f"  Per-cluster aggAmp centroids: "
                      + ", ".join(f"C{i}={v:.3f}" for i, v in enumerate(cents)) + "\n"
                      f"  Centroid-assignment accuracy: {thr_info['centroid_accuracy']:.1%}")

    lines = [
        "# Phase 11 -- Disease Subtype Identification",
        "",
        "## Setup",
        f"  n configs:  {result['n_configs']} (top-20 genuine critical from Phase 10)",
        f"  Features:   {', '.join(result['features'])}",
        "",
        "## PCA",
        f"  PC1 explains {pca_r['explained_variance_ratio'][0]:.1%} of variance",
        f"  PC2 explains {pca_r['explained_variance_ratio'][1]:.1%} of variance",
        f"  Cumulative (2 PCs): {pca_r['cumulative_2pc']:.1%}",
        "",
        "  PC1 loadings (dominant drivers):",
        load_rows,
        "",
        "## K-means Clustering",
        sil_rows,
        f"  Best k = {best_k}",
        "",
        "## Cluster Characterisation",
        *[r for row in clus_rows for r in row.split("\n")],
        "",
        "## Q1: Is there a meaningful subtype structure?",
        f"  Best k={best_k} silhouette={km_r['best_silhouette']:.4f}",
        ("  YES -- silhouette > 0.50 indicates well-separated clusters."
         if km_r["best_silhouette"] > 0.50 else
         "  WEAK -- silhouette < 0.50 indicates overlapping clusters; "
         "subtypes exist but boundaries are soft."),
        "",
        "## Q2: Does aggAmp alone predict cluster?",
        f"  Pearson r(aggAmp, cluster) = {clf_r:.3f}",
        f"  Centroid-classifier accuracy = {clf_acc:.1%}",
        clf_detail,
        ("  YES -- aggAmp is a strong single predictor of subtype."
         if clf_acc >= 0.80 else
         "  PARTIAL -- aggAmp explains some subtype variance but is insufficient alone."),
        "",
        "## Clinical Interpretation",
        "  Calibration: 1 step ~ 2.25 days  |  silent phase ~ 200 steps ~ 15 months",
        "",
    ]

    for c_info in sorted(clus, key=lambda x: x["mean_features"]["aggregationAmplification"]):
        c    = c_info["cluster"]
        mf   = c_info["mean_features"]
        mt   = c_info["mean_max_start_t_any"]
        ms   = c_info["mean_min_strength_prev"]
        days = f"~{mt * 2.25:.0f} days" if mt is not None else "window closed"
        ms_s = f"{ms:.2f}" if ms is not None else "n/a"
        lines.append(
            f"  Cluster {c} (aggAmp~{mf['aggregationAmplification']:.2f}): "
            f"therapy window open until t~{mt:.0f} ({days}), "
            f"min strength {ms_s}"
            if mt is not None else
            f"  Cluster {c} (aggAmp~{mf['aggregationAmplification']:.2f}): "
            f"therapy window: always preventable (flat boundary), min strength {ms_s}"
        )

    lines += [
        "",
        "---",
        "_Generated by `phase11_subtypes.py` -- ALS connectome project Phase 11_",
    ]
    return "\n".join(lines)

report = build_report(result)
with open("results/phase11_subtypes_report.md", "w", encoding="utf-8") as f:
    f.write(report)
print("Saved -> results/phase11_subtypes_report.md")
print()
print("Done.")
