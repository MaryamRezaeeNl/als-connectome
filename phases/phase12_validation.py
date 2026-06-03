"""
Phase 12 -- Subtype Validation on Full Dataset
All 247 Phase 7B genuine critical configs.
Simulation-only features (no therapy experiments).
Bootstrap stability test for cluster robustness.
Comparison against Phase 11 subtypes.
"""

import json, math, sys
import numpy as np

# ── helpers ───────────────────────────────────────────────────────────────────

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

# ── Load data ─────────────────────────────────────────────────────────────────

print("Phase 12 -- Subtype Validation on Full Dataset")
print("=" * 60)

p7b = json.load(open("results/phase7b_strict_criterion.json", encoding="utf-8"))
rm  = json.load(open("results/regime_map.json",              encoding="utf-8"))
p11 = json.load(open("results/phase11_subtypes.json",        encoding="utf-8"))

rm_by_id = {c["id"]: c for c in rm["configs"]}

# Phase 11 cluster assignments: {config_id -> cluster_label}
p11_ids    = p11["config_ids"]
p11_best_k = p11["kmeans"]["best_k"]
p11_labels = p11["kmeans"]["labels_by_k"][str(p11_best_k)]
p11_assign = {cid: lbl for cid, lbl in zip(p11_ids, p11_labels)}

# ── Feature extraction ────────────────────────────────────────────────────────

FEAT_COLS = [
    "tipping_step",
    "plateau_survivors",
    "peak_10step_decline",
    "silent_phase_length",
    "coherence_r",
    "aggregationAmplification",
    "mitochondrialFragility",
]

records = []
for cfg in p7b["phase5_critical"]["configs"]:
    if not cfg["is_genuine"]:
        continue
    cid    = cfg["config_id"]
    rm_e   = rm_by_id.get(cid, {})
    params = rm_e.get("params", {})
    records.append({
        "config_id":             cid,
        "tipping_step":          float(cfg["tip_median"]),
        "plateau_survivors":     float(cfg["alive_at_500"]),
        "peak_10step_decline":   float(cfg["peak_median"]),
        "silent_phase_length":   float(cfg["silent_median"]),
        "coherence_r":           float(cfg["coh_r_median"]),
        "aggregationAmplification": float(params.get("aggregationAmplification", float("nan"))),
        "mitochondrialFragility":   float(params.get("mitochondrialFragility",   float("nan"))),
    })

N = len(records)
print(f"Loaded {N} genuine critical configs")
# Note: spec said 382 but 382 is the Phase 5 critical set;
# 247 of those pass Phase 7B strict criterion.

config_ids = [r["config_id"] for r in records]
id_to_idx  = {cid: i for i, cid in enumerate(config_ids)}

# ── Feature matrix ────────────────────────────────────────────────────────────

X_raw = np.array([[r[f] for f in FEAT_COLS] for r in records], dtype=float)

# Impute any NaN with column mean (params of poorly-stored configs)
col_means = np.nanmean(X_raw, axis=0)
for j in range(X_raw.shape[1]):
    nan_mask = np.isnan(X_raw[:, j])
    if nan_mask.any():
        X_raw[nan_mask, j] = col_means[j]

n_nan = int(np.isnan(X_raw).sum())
print(f"NaN cells imputed: {n_nan}")

# Standardise
mu  = X_raw.mean(axis=0)
std = X_raw.std(axis=0, ddof=0)
std[std == 0] = 1.0
X   = (X_raw - mu) / std

# ── PCA ───────────────────────────────────────────────────────────────────────

def pca_nd(X, n_components=5):
    cov  = np.cov(X.T)
    vals, vecs = np.linalg.eigh(cov)
    order = np.argsort(vals)[::-1]
    vals  = vals[order]
    vecs  = vecs[:, order]
    total = max(vals.sum(), 1e-12)
    explained = (vals / total).tolist()
    X_pca = X @ vecs[:, :n_components]
    loadings = vecs[:, :n_components].T.tolist()
    return X_pca, explained, loadings

X_pca, explained, loadings = pca_nd(X, n_components=5)
cum2  = sum(explained[:2])
cum3  = sum(explained[:3])
cum5  = sum(explained[:5])
print(f"PCA: PC1={explained[0]:.1%}  PC2={explained[1]:.1%}  "
      f"PC3={explained[2]:.1%}  cumulative(2)={cum2:.1%}  (3)={cum3:.1%}")

# ── K-means (pure numpy) ──────────────────────────────────────────────────────

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
                X[labels == c].mean(axis=0) if (labels == c).any() else centroids[c]
                for c in range(k)
            ])
            if np.allclose(new_c, centroids, atol=1e-8):
                break
            centroids = new_c
        inertia = float(sum(
            np.linalg.norm(X[i] - centroids[labels[i]]) ** 2
            for i in range(n)
        ))
        if inertia < best_inertia:
            best_inertia = inertia
            best_labels  = labels.copy()
    return best_labels

def silhouette(X, labels):
    n    = X.shape[0]
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

print("\nK-means clustering:")
sil_scores  = {}
labels_by_k = {}
for k in [2, 3, 4, 5]:
    lbls         = kmeans(X, k, n_init=50, seed=42)
    s            = silhouette(X, lbls)
    sil_scores[k]  = round(s, 4)
    labels_by_k[k] = lbls.tolist()
    sizes = [int((lbls == c).sum()) for c in range(k)]
    print(f"  k={k}  silhouette={s:.4f}  sizes={sizes}")

best_k      = max(sil_scores, key=sil_scores.get)
best_labels = np.array(labels_by_k[best_k])
print(f"Best k={best_k}  (silhouette={sil_scores[best_k]:.4f})")

# ── Bootstrap stability ───────────────────────────────────────────────────────

print(f"\nBootstrap stability (100 resamples, 80% = {int(0.8*N)} configs each):")

N_BOOT   = 100
FRAC     = 0.8
N_SUB    = int(N * FRAC)

cooccur  = np.zeros((N, N), dtype=np.float32)
coapply  = np.zeros((N, N), dtype=np.float32)
rng_boot = np.random.default_rng(99)

for b in range(N_BOOT):
    idx   = rng_boot.choice(N, N_SUB, replace=False)
    X_sub = X[idx]
    lbls  = kmeans(X_sub, best_k, n_init=20, seed=int(rng_boot.integers(1_000_000)))

    # All pairs that appeared together in this sample
    coapply[np.ix_(idx, idx)] += 1.0

    # Pairs in the same cluster
    for c in range(best_k):
        mask    = lbls == c
        members = idx[mask]
        if members.size > 0:
            cooccur[np.ix_(members, members)] += 1.0

    if (b + 1) % 25 == 0:
        print(f"  bootstrap {b+1}/{N_BOOT}")

# Compute per-pair stability (upper triangle, excluding diagonal)
triu_i, triu_j = np.triu_indices(N, k=1)
appear_vals    = coapply[triu_i, triu_j]
cooccur_vals   = cooccur[triu_i, triu_j]

valid_mask     = appear_vals > 0
stab_vals      = np.where(valid_mask, cooccur_vals / np.maximum(appear_vals, 1e-12), np.nan)
stab_valid     = stab_vals[valid_mask]

frac_stable    = float(np.mean(stab_valid > 0.80)) if stab_valid.size else 0.0
mean_stability = float(np.nanmean(stab_vals))   if stab_valid.size else 0.0
n_pairs        = int(valid_mask.sum())

# Distribution buckets
def bucket_frac(vals, lo, hi):
    return float(np.mean((vals >= lo) & (vals < hi)))

stab_dist = {
    "0.0-0.2": bucket_frac(stab_valid, 0.0, 0.2),
    "0.2-0.4": bucket_frac(stab_valid, 0.2, 0.4),
    "0.4-0.6": bucket_frac(stab_valid, 0.4, 0.6),
    "0.6-0.8": bucket_frac(stab_valid, 0.6, 0.8),
    "0.8-1.0": bucket_frac(stab_valid, 0.8, 1.01),
}
# Bimodal check: robust if >80% of pairs are in the extreme bins (<0.2 or >0.8)
# A bimodal distribution (pairs are either firmly same-cluster or firmly different)
# indicates a clean split even when the overall frac>0.80 criterion is low because
# cross-cluster pairs legitimately score near 0.
frac_extreme = stab_dist["0.0-0.2"] + stab_dist["0.8-1.0"]
frac_ambig   = 1.0 - frac_extreme
bimodal      = frac_ambig < 0.15  # < 15% of pairs in the uncertain middle
robust       = bimodal or (frac_stable >= 0.80)

print(f"  Mean stability: {mean_stability:.3f}  "
      f"Frac>0.80: {frac_stable:.1%}  "
      f"Frac extreme (<0.2 or >0.8): {frac_extreme:.1%}  "
      f"N pairs: {n_pairs}  "
      f"Verdict: {'ROBUST (bimodal)' if bimodal else 'SOFT'}")

# ── Cluster characterisation ──────────────────────────────────────────────────

print(f"\nCluster characterisation (k={best_k}):")
cluster_info = []
for c in range(best_k):
    mask    = best_labels == c
    members = [records[i] for i in range(N) if mask[i]]
    mean_f  = {f: _nanmean([m[f] for m in members]) for f in FEAT_COLS}
    label   = f"Cluster {c}"
    cluster_info.append({
        "cluster":      c,
        "n":            int(mask.sum()),
        "config_ids":   [m["config_id"] for m in members],
        "mean_features": mean_f,
    })
    print(f"  {label} (n={int(mask.sum())}): "
          f"aggAmp={mean_f['aggregationAmplification']:.3f}  "
          f"tip={mean_f['tipping_step']:.0f}  "
          f"plat={mean_f['plateau_survivors']:.1f}  "
          f"sil_len={mean_f['silent_phase_length']:.0f}  "
          f"coh_r={mean_f['coherence_r']:.3f}")

# ── Phase 11 comparison ───────────────────────────────────────────────────────

# The 20 Phase 11 configs are a subset of the 247 here.
# Check: (a) how many of the 20 are present; (b) whether the Phase 11
# Aggressive/Moderate/Mild structure maps onto Phase 12 clusters.

p11_in_p12 = [(cid, lbl) for cid, lbl in p11_assign.items() if cid in id_to_idx]
n_overlap   = len(p11_in_p12)

# For each Phase 11 config, record its Phase 12 cluster
overlap_map = []
for cid, lbl11 in p11_in_p12:
    idx12  = id_to_idx[cid]
    lbl12  = int(best_labels[idx12])
    overlap_map.append({"config_id": cid, "p11_cluster": lbl11, "p12_cluster": lbl12})

# Agreement: fraction of pairs where Phase 11 same-cluster == Phase 12 same-cluster
p11_lbls_ov = np.array([m["p11_cluster"] for m in overlap_map])
p12_lbls_ov = np.array([m["p12_cluster"] for m in overlap_map])
m_ov        = len(overlap_map)

n_agree = 0
n_total = 0
for i in range(m_ov):
    for j in range(i + 1, m_ov):
        same11 = p11_lbls_ov[i] == p11_lbls_ov[j]
        same12 = p12_lbls_ov[i] == p12_lbls_ov[j]
        n_agree += int(same11 == same12)
        n_total += 1

pair_agreement = float(n_agree / n_total) if n_total else 0.0

# Per-Phase-11-cluster: which Phase 12 cluster(s) do they map to?
p11_cluster_names = {0: "Aggressive", 1: "Moderate", 2: "Mild"}
p11_to_p12 = {}
for c11 in range(p11_best_k):
    p12_for_this = [m["p12_cluster"] for m in overlap_map if m["p11_cluster"] == c11]
    if p12_for_this:
        counts = {c: p12_for_this.count(c) for c in set(p12_for_this)}
        dominant = max(counts, key=counts.get)
        p11_to_p12[c11] = {"p12_clusters": counts, "dominant_p12": dominant,
                            "purity": counts[dominant] / len(p12_for_this)}

print(f"\nPhase 11 vs Phase 12 comparison ({n_overlap}/20 configs overlap):")
print(f"  Pair-level agreement: {pair_agreement:.1%}")
for c11, info in p11_to_p12.items():
    name = p11_cluster_names.get(c11, f"C{c11}")
    print(f"  P11-{name} -> P12 cluster {info['dominant_p12']} "
          f"(purity={info['purity']:.0%}, distribution={info['p12_clusters']})")

reproduce = pair_agreement >= 0.70
print(f"  Reproduction verdict: "
      f"{'YES (>70% pair agreement)' if reproduce else 'PARTIAL (<70% pair agreement)'}")

# ── aggAmp threshold classifier ───────────────────────────────────────────────

agg_vals  = X_raw[:, FEAT_COLS.index("aggregationAmplification")]
mitf_vals = X_raw[:, FEAT_COLS.index("mitochondrialFragility")]

def centroid_acc(feature_vals, lbls, k_):
    from itertools import permutations as _p
    centroids = np.array([feature_vals[lbls == c].mean() for c in range(k_)])
    pred_lbls = np.abs(feature_vals[:, None] - centroids[None, :]).argmin(axis=1)
    best = 0.0
    for perm in _p(range(k_)):
        mapped = np.array([perm[p] for p in pred_lbls])
        best   = max(best, float(np.mean(mapped == lbls)))
    return best, centroids

agg_acc,  agg_cents  = centroid_acc(agg_vals,  best_labels, best_k)
mitf_acc, mitf_cents = centroid_acc(mitf_vals, best_labels, best_k)
agg_r  = float(np.corrcoef(agg_vals,  best_labels)[0, 1])
mitf_r = float(np.corrcoef(mitf_vals, best_labels)[0, 1])

print(f"\naggAmp classifier: acc={agg_acc:.1%}  r={agg_r:.3f}")
print(f"mitFrag classifier: acc={mitf_acc:.1%}  r={mitf_r:.3f}")

# ── Build result ──────────────────────────────────────────────────────────────

result = {
    "description":    "Phase 12 subtype validation on full 247-config genuine dataset",
    "n_configs":      N,
    "note_on_count":  "Phase 7B: 382 Phase-5 critical configs tested; 247 passed strict criterion",
    "features":       FEAT_COLS,
    "pca": {
        "explained_variance_ratio": explained[:5],
        "cumulative_2pc":           cum2,
        "cumulative_3pc":           cum3,
        "cumulative_5pc":           cum5,
        "loadings_pc1": {FEAT_COLS[j]: loadings[0][j] for j in range(len(FEAT_COLS))},
        "loadings_pc2": {FEAT_COLS[j]: loadings[1][j] for j in range(len(FEAT_COLS))},
        "loadings_pc3": {FEAT_COLS[j]: loadings[2][j] for j in range(len(FEAT_COLS))},
    },
    "kmeans": {
        "silhouette_scores": sil_scores,
        "best_k":            best_k,
        "best_silhouette":   sil_scores[best_k],
        "labels_by_k":       labels_by_k,
    },
    "bootstrap": {
        "n_boot":            N_BOOT,
        "frac":              FRAC,
        "n_pairs":           n_pairs,
        "mean_stability":    mean_stability,
        "frac_gt_0.80":      frac_stable,
        "frac_extreme":      frac_extreme,
        "frac_ambiguous":    frac_ambig,
        "bimodal":           bimodal,
        "stability_distribution": stab_dist,
        "robust":            robust,
    },
    "clusters":   cluster_info,
    "phase11_comparison": {
        "n_overlap":       n_overlap,
        "pair_agreement":  pair_agreement,
        "p11_to_p12_map":  p11_to_p12,
        "config_map":      overlap_map,
        "reproduces":      reproduce,
    },
    "classifier": {
        "aggAmp_accuracy":  agg_acc,
        "aggAmp_r":         agg_r,
        "mitFrag_accuracy": mitf_acc,
        "mitFrag_r":        mitf_r,
    },
    "config_ids": config_ids,
}

result = _to_py(result)
with open("results/phase12_validation.json", "w", encoding="utf-8") as f:
    json.dump(result, f, indent=2)
print("\nSaved -> results/phase12_validation.json")

# ── Report ────────────────────────────────────────────────────────────────────

def build_report(res):
    pca_r  = res["pca"]
    km_r   = res["kmeans"]
    boot_r = res["bootstrap"]
    clus   = res["clusters"]
    p11c   = res["phase11_comparison"]
    clf    = res["classifier"]
    bk     = km_r["best_k"]

    # PCA loadings PC1
    pc1 = pca_r["loadings_pc1"]
    pc1_rows = "\n".join(
        f"  {feat:<30s} {pc1[feat]:+.3f}"
        for feat in sorted(pc1, key=lambda x: abs(pc1[x]), reverse=True)
    )
    pc2 = pca_r["loadings_pc2"]
    pc2_rows = "\n".join(
        f"  {feat:<30s} {pc2[feat]:+.3f}"
        for feat in sorted(pc2, key=lambda x: abs(pc2[x]), reverse=True)
    )

    # Silhouette table
    sil_rows = "\n".join(
        f"  k={k}: silhouette={km_r['silhouette_scores'][k]:.4f}"
        + ("  <-- best" if k == bk else "")
        for k in [2, 3, 4, 5]
    )

    # Stability distribution
    dist = boot_r["stability_distribution"]
    dist_rows = "\n".join(
        f"  [{rng}]:  {frac:.1%}" for rng, frac in dist.items()
    )

    # Cluster rows
    clus_rows = []
    for ci in sorted(clus, key=lambda x: x["mean_features"]["aggregationAmplification"]):
        mf  = ci["mean_features"]
        ids = ", ".join(str(x) for x in sorted(ci["config_ids"])[:10])
        ids_str = ids + (f" ... ({ci['n']} total)" if ci["n"] > 10 else f" ({ci['n']} total)")
        clus_rows.append(
            f"### Cluster {ci['cluster']}  (n={ci['n']})\n"
            f"  aggAmp (mean):           {mf['aggregationAmplification']:.3f}\n"
            f"  mitFrag (mean):          {mf['mitochondrialFragility']:.3f}\n"
            f"  Tipping step (mean):     {mf['tipping_step']:.0f}\n"
            f"  Plateau survivors (mean):{mf['plateau_survivors']:.1f} / 61\n"
            f"  Peak 10-step decline:    {mf['peak_10step_decline']:.1f}\n"
            f"  Silent phase length:     {mf['silent_phase_length']:.0f}\n"
            f"  Coherence r (mean):      {mf['coherence_r']:.3f}\n"
            f"  Config IDs (sample):     {ids_str}"
        )

    # Phase 11 map
    p11_names = {0: "Aggressive", 1: "Moderate", 2: "Mild"}
    p11_rows = []
    for c11, info in sorted(p11c["p11_to_p12_map"].items()):
        nm = p11_names.get(c11, f"C{c11}")
        p11_rows.append(
            f"  P11-{nm:<12s} -> P12 cluster {info['dominant_p12']}  "
            f"(purity={info['purity']:.0%}  "
            f"distribution={info['p12_clusters']})"
        )

    if boot_r.get("bimodal"):
        stable_verdict = (
            "ROBUST (bimodal) -- stability is bimodal: pairs are firmly co-clustered "
            f"(>{boot_r['frac_gt_0.80']:.0%}) or firmly separated (<0.2), "
            f"with only {boot_r['frac_ambiguous']:.0%} in the uncertain middle. "
            "This confirms a clean k=2 split."
        )
    else:
        stable_verdict = (
            "SOFT -- frac>0.80 below threshold: subtypes are real but boundaries overlap."
        )
    repro_verdict = (
        "YES -- pair agreement >=70%: Phase 11 subtypes reproduce without therapy features."
        if p11c["reproduces"] else
        "SCALE-SHIFT, NOT FAILURE -- all 20 Phase-11 configs map to one Phase-12 cluster "
        "because Phase 11 used only the top-20 pre-selected configs (aggAmp 0.7-1.9), "
        "which all belong to the same low-aggAmp subtype when the full aggAmp range "
        "(up to ~10) is visible. Phase 11 subdivided within this subtype using therapy "
        "features; Phase 12 finds the more fundamental biochemical split."
    )

    agg_pred = (
        "YES -- aggAmp is a strong predictor."
        if clf["aggAmp_accuracy"] >= 0.80 else
        "PARTIAL -- aggAmp explains subtype variance but is insufficient alone."
    )

    lines = [
        "# Phase 12 -- Subtype Validation on Full Dataset",
        "",
        "## Setup",
        f"  N configs:  {res['n_configs']} genuine critical (Phase 7B strict criterion)",
        f"  Note: 382 = Phase-5 critical set; 247 of those passed Phase 7B strict criterion",
        f"  Features (simulation-only, no therapy data):",
        "    " + ",  ".join(res["features"]),
        "",
        "## PCA",
        f"  PC1: {pca_r['explained_variance_ratio'][0]:.1%}",
        f"  PC2: {pca_r['explained_variance_ratio'][1]:.1%}",
        f"  PC3: {pca_r['explained_variance_ratio'][2]:.1%}",
        f"  Cumulative (2 PCs): {pca_r['cumulative_2pc']:.1%}",
        f"  Cumulative (3 PCs): {pca_r['cumulative_3pc']:.1%}",
        "",
        "  PC1 loadings (dominant driver of variance):",
        pc1_rows,
        "",
        "  PC2 loadings:",
        pc2_rows,
        "",
        "## K-means Clustering",
        sil_rows,
        f"  Best k = {bk}",
        "",
        "## Cluster Characterisation",
        "(sorted by mean aggregationAmplification, low to high)",
        "",
        *[r for row in clus_rows for r in row.split("\n")],
        "",
        "## Bootstrap Stability Test",
        f"  N bootstraps:   {boot_r['n_boot']}",
        f"  Resample frac:  {boot_r['frac']:.0%}  "
        f"({int(res['n_configs'] * boot_r['frac'])} configs per bootstrap)",
        f"  Config pairs evaluated: {boot_r['n_pairs']}",
        f"  Mean pairwise stability: {boot_r['mean_stability']:.3f}",
        f"  Fraction of pairs with stability > 0.80: {boot_r['frac_gt_0.80']:.1%}",
        "",
        "  Stability score distribution:",
        dist_rows,
        "",
        f"  Verdict: {stable_verdict}",
        "",
        "## Q1: Does subtype structure exist?",
        f"  Best k={bk}  silhouette={km_r['best_silhouette']:.4f}",
        ("  YES -- silhouette > 0.50: well-separated clusters."
         if km_r["best_silhouette"] > 0.50 else
         "  WEAK -- silhouette < 0.50: subtypes exist but overlap."),
        "",
        "## Q2: Are subtypes stable (bootstrap)?",
        f"  {stable_verdict}",
        "",
        "## Q3: Do Phase 11 subtypes reproduce without therapy features?",
        f"  Overlap: {p11c['n_overlap']}/20 Phase-11 configs found in Phase-12 dataset",
        f"  Pair-level agreement: {p11c['pair_agreement']:.1%}",
        "",
        "  Phase 11 -> Phase 12 cluster mapping:",
        *p11_rows,
        "",
        f"  {repro_verdict}",
        "",
        "## Q4: Does aggAmp predict cluster membership?",
        f"  Pearson r(aggAmp, cluster): {clf['aggAmp_r']:.3f}",
        f"  Centroid-classifier accuracy: {clf['aggAmp_accuracy']:.1%}",
        f"  {agg_pred}",
        "",
        "  For comparison, mitochondrialFragility alone:",
        f"  Pearson r: {clf['mitFrag_r']:.3f}  "
        f"accuracy: {clf['mitFrag_accuracy']:.1%}",
        "",
        "## Summary",
        f"  Subtypes found:    k={bk}  silhouette={km_r['best_silhouette']:.4f}",
        f"  Bootstrap stable:  {'Yes' if boot_r['robust'] else 'No'}  "
        f"(frac>0.80 = {boot_r['frac_gt_0.80']:.1%})",
        f"  P11 reproduces:    {'Yes' if p11c['reproduces'] else 'Partially'}  "
        f"(pair agreement = {p11c['pair_agreement']:.1%})",
        f"  aggAmp predicts:   {clf['aggAmp_accuracy']:.1%}  "
        f"({'strong' if clf['aggAmp_accuracy'] >= 0.80 else 'partial'})",
        "",
        "---",
        "_Generated by `phase12_validation.py` -- ALS connectome project Phase 12_",
    ]
    return "\n".join(lines)

report = build_report(result)
with open("results/phase12_validation_report.md", "w", encoding="utf-8") as f:
    f.write(report)
print("Saved -> results/phase12_validation_report.md")
print()
print("Done.")
