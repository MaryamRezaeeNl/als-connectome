"""Generate all 9 paper figures from results/ JSON files.

Saves PNG files (300 dpi, 8x5 in) to figures/.
Requires matplotlib and numpy.  Import CriticalitySimulator for Figures 1-2.
"""

import sys
import json
import math
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.colors import ListedColormap
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / 'phases'))
from phase5_criticality import CriticalitySimulator

# ── Style constants ────────────────────────────────────────────────────────────
BLUE   = '#2196F3'
RED    = '#F44336'
GREEN  = '#4CAF50'
ORANGE = '#FF9800'
GRAY   = '#9E9E9E'

DPI      = 300
FIG_W, FIG_H = 8, 5
DEAD_THR = 0.15

RESULTS = Path('results')
FIGURES = Path('figures')
FIGURES.mkdir(exist_ok=True)


def style_ax(ax, xlabel='', ylabel='', grid_x=False):
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.yaxis.grid(True, color='#E0E0E0', linewidth=0.7)
    if grid_x:
        ax.xaxis.grid(True, color='#E0E0E0', linewidth=0.7)
    ax.set_axisbelow(True)
    ax.tick_params(labelsize=9)
    if xlabel:
        ax.set_xlabel(xlabel, fontsize=11)
    if ylabel:
        ax.set_ylabel(ylabel, fontsize=11)


def pearson_r(x, y):
    x, y = np.asarray(x, float), np.asarray(y, float)
    return float(np.corrcoef(x, y)[0, 1])


def load_json(filename):
    with open(RESULTS / filename) as f:
        return json.load(f)


# ── Load all data ──────────────────────────────────────────────────────────────
print("Loading JSON results...")
rm  = load_json('regime_map.json')
p7b = load_json('phase7b_strict_criterion.json')
p7c = load_json('phase7c_topology.json')
p9  = load_json('phase9_phase_diagram.json')
p10 = load_json('phase10_boundary_robustness.json')
p12 = load_json('phase12_validation.json')
p14 = load_json('phase14_breaking.json')

rm_by_id  = {c['id']: c for c in rm['configs']}
p7b_by_id = {c['config_id']: c for c in p7b['phase5_critical']['configs']}


# ── Figure 1 (Supplementary): Three dynamical regimes ─────────────────────────

def fig1_supplementary():
    print("Figure 1: running 3 representative configs...")

    stable_cfg   = next(c for c in rm['configs'] if c['regime'] == 'stable')
    critical_cfg = rm_by_id[333]          # config #334, 0-indexed
    runaway_cfg  = next(c for c in rm['configs'] if c['regime'] == 'runaway')

    def run_sim(cfg):
        sim = CriticalitySimulator(seed=cfg['id'] + 100, noise_scale=0.003,
                                   params=cfg['params'])
        hist = []
        for _ in range(500):
            hist.append(sim.step())
        return hist

    print("  stable...")
    stable_hist   = run_sim(stable_cfg)
    print("  critical (config #334)...")
    critical_hist = run_sim(critical_cfg)
    print("  runaway...")
    runaway_hist  = run_sim(runaway_cfg)

    fig, (ax_main, ax_scatter) = plt.subplots(1, 2, figsize=(FIG_W, FIG_H))
    steps = list(range(1, 501))

    ax_main.plot(steps, stable_hist,   color=GREEN,  linewidth=1.8,
                 label=f'Stable (aggAmp={stable_cfg["params"]["aggregationAmplification"]:.2f})')
    ax_main.plot(steps, critical_hist, color=BLUE,   linewidth=1.8,
                 label=f'Critical (aggAmp={critical_cfg["params"]["aggregationAmplification"]:.2f})')
    ax_main.plot(steps, runaway_hist,  color=RED,    linewidth=1.8,
                 label=f'Runaway (aggAmp={runaway_cfg["params"]["aggregationAmplification"]:.2f})')
    style_ax(ax_main, 'Simulation step', 'Alive neurons')
    ax_main.set_ylim(0, 66)
    ax_main.legend(fontsize=8, frameon=False)
    ax_main.set_title('A  Survival curves', fontsize=11, loc='left')

    # Scatter: aggAmp vs regime (all 500 configs)
    regime_to_y  = {'stable': 0, 'critical': 1, 'runaway': 2}
    regime_color = {'stable': GREEN, 'critical': BLUE, 'runaway': RED}
    for cfg in rm['configs']:
        r = cfg['regime']
        ax_scatter.scatter(
            cfg['params']['aggregationAmplification'],
            regime_to_y[r],
            color=regime_color[r], alpha=0.4, s=12, linewidths=0
        )
    ax_scatter.set_xscale('log')
    ax_scatter.set_yticks([0, 1, 2])
    ax_scatter.set_yticklabels(['Stable', 'Critical', 'Runaway'], fontsize=9)
    style_ax(ax_scatter, 'aggregationAmplification (log scale)', '')
    ax_scatter.set_title('B  Regime separation (500 configs)', fontsize=11, loc='left')
    ax_scatter.yaxis.grid(False)

    plt.tight_layout()
    out = FIGURES / 'fig1_supplementary_regimes.png'
    plt.savefig(out, dpi=DPI, bbox_inches='tight')
    plt.close()
    print(f"  -> {out}")


# ── Figure 2: Config #334 triphasic degeneration ──────────────────────────────

def fig2_triphasic():
    from connectome import NEURON_NAMES, VULNERABILITY as VULN_DICT
    print("Figure 2: running config #334 (500 steps)...")

    cfg = rm_by_id[333]
    sim = CriticalitySimulator(seed=434, noise_scale=0.003, params=cfg['params'])

    hist_alive  = []
    death_steps = np.full(sim.n, 500, dtype=int)
    alive_prev  = np.ones(sim.n, dtype=bool)

    for t in range(1, 501):
        sim.step()
        alive_now = sim.health > DEAD_THR
        newly_dead = alive_prev & ~alive_now
        if newly_dead.any():
            death_steps[newly_dead] = t
        alive_prev = alive_now.copy()
        hist_alive.append(int(alive_now.sum()))

    vuln = np.array([VULN_DICT[n] for n in NEURON_NAMES])

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(FIG_W, FIG_H))

    # Survival curve with phase annotations
    steps = list(range(1, 501))
    ax1.plot(steps, hist_alive, color=BLUE, linewidth=1.8)
    ax1.axvline(200, color=GRAY, linestyle='--', linewidth=1)
    ax1.axvline(260, color=GRAY, linestyle='--', linewidth=1)
    ax1.text(100, 63, 'Silent\n(t=1-200)', ha='center', fontsize=8, color='#555555')
    ax1.text(230, 63, 'Collapse', ha='center', fontsize=8, color='#555555')
    ax1.text(380, 63, 'Plateau\n(t=261-500)', ha='center', fontsize=8, color='#555555')
    style_ax(ax1, 'Simulation step', 'Alive neurons')
    ax1.set_ylim(0, 67)
    ax1.set_title('A  Triphasic degeneration (config #334)', fontsize=11, loc='left')

    # Per-neuron: vulnerability vs death step (use -death_step to match phase7b coh_r sign)
    died = death_steps < 500
    ax2.scatter(vuln[died],  death_steps[died],  color=RED,   alpha=0.75, s=30, label='Died')
    ax2.scatter(vuln[~died], np.full((~died).sum(), 500),
                color=GREEN, alpha=0.75, s=30, marker='^', label='Survived')
    r = pearson_r(vuln[died], -death_steps[died].astype(float))
    ax2.text(0.05, 0.93, f'r(vulnerability, -death step) = {r:.3f}',
             transform=ax2.transAxes, fontsize=8)
    style_ax(ax2, 'Vulnerability score', 'Death step')
    ax2.legend(fontsize=8, frameon=False)
    ax2.set_title('B  Per-neuron death step vs. vulnerability', fontsize=11, loc='left')

    plt.tight_layout()
    out = FIGURES / 'fig2_config334_triphasic.png'
    plt.savefig(out, dpi=DPI, bbox_inches='tight')
    plt.close()
    print(f"  -> {out}")


# ── Figure 3: Null model falsification ────────────────────────────────────────

def fig3_null_model():
    print("Figure 3: null model falsification...")

    null_coh    = [r['coh_r_median'] for r in p7b['null_model']['runs']]
    genuine_coh = [c['coh_r_median'] for c in p7b['phase5_critical']['configs']
                   if c['is_genuine']]

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(FIG_W, FIG_H))

    bins = np.linspace(-0.5, 1.0, 26)
    ax1.hist(null_coh, bins=bins, color=GRAY, alpha=0.75,
             label=f'Null model  n=100  mean={np.mean(null_coh):.2f}')
    ax1.hist(genuine_coh, bins=bins, color=BLUE, alpha=0.70,
             label=f'Genuine critical  n={len(genuine_coh)}  mean={np.mean(genuine_coh):.2f}')
    ax1.axvline(0.30, color=RED, linestyle='--', linewidth=1.3, label='Threshold r=0.30')
    style_ax(ax1, 'Spatial coherence r (median)', 'Count')
    ax1.legend(fontsize=8, frameon=False)
    ax1.set_title('A  Coherence distributions', fontsize=11, loc='left')

    # ROC curve: vary coh_r threshold, compute FPR and TPR
    thresholds = np.linspace(-0.65, 1.0, 300)
    null_arr    = np.array(null_coh)
    genuine_arr = np.array(genuine_coh)
    tpr = np.array([(genuine_arr >= t).mean() for t in thresholds])
    fpr = np.array([(null_arr    >= t).mean() for t in thresholds])

    ax2.plot(fpr, tpr, color=BLUE, linewidth=2)
    ax2.plot([0, 1], [0, 1], color=GRAY, linestyle='--', linewidth=1)

    # Mark the operating point at r=0.30
    t_idx = int(np.argmin(np.abs(thresholds - 0.30)))
    ax2.scatter(fpr[t_idx], tpr[t_idx], color=RED, s=70, zorder=5,
                label=f'r=0.30:  FPR={fpr[t_idx]:.0%}  TPR={tpr[t_idx]:.0%}')
    ax2.set_xlim(-0.02, 1.02)
    ax2.set_ylim(-0.02, 1.05)
    style_ax(ax2, 'False positive rate', 'True positive rate')
    ax2.legend(fontsize=8, frameon=False)
    ax2.set_title('B  ROC curve  (coherence criterion)', fontsize=11, loc='left')

    plt.tight_layout()
    out = FIGURES / 'fig3_null_model_falsification.png'
    plt.savefig(out, dpi=DPI, bbox_inches='tight')
    plt.close()
    print(f"  -> {out}")


# ── Figure 4: Topology dependence ─────────────────────────────────────────────

def fig4_topology():
    print("Figure 4: topology dependence...")

    topo_keys   = ['celegans', 'ws', 'shuffled', 'er', 'ba']
    topo_labels = ['C. elegans', 'Watts-Strogatz', 'Degree-shuffled',
                   'Erdos-Renyi', 'Barabasi-Albert']

    genuine_rates = [p7c['baseline_results'][t]['genuine_tipping_rate']
                     for t in topo_keys]
    coh_means     = [p7c['baseline_results'][t]['mean_spatial_coh']
                     for t in topo_keys]

    fig, ax = plt.subplots(figsize=(FIG_W, FIG_H))
    y = np.arange(len(topo_keys))

    ax.barh(y, genuine_rates, color=BLUE, alpha=0.85, height=0.5)

    # Value labels on bars
    for i, gtr in enumerate(genuine_rates):
        ax.text(gtr + 0.015, i, f'{gtr:.3f}', va='center', fontsize=8)

    ax.set_yticks(y)
    ax.set_yticklabels(topo_labels, fontsize=9)
    ax.set_xlabel('Genuine tipping rate', fontsize=11)
    ax.set_xlim(0, 1.15)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.xaxis.grid(True, color='#E0E0E0', linewidth=0.7)
    ax.set_axisbelow(True)
    ax.tick_params(labelsize=9)

    # Secondary x-axis for coherence r
    ax2 = ax.twiny()
    ax2.scatter(coh_means, y, color=ORANGE, s=70, zorder=5,
                label='Mean spatial coherence r')
    for i, coh in enumerate(coh_means):
        ax2.text(coh + 0.015, i - 0.25, f'{coh:.3f}', fontsize=7.5, color=ORANGE)
    ax2.set_xlabel('Mean spatial coherence r', fontsize=10, color=ORANGE)
    ax2.tick_params(labelsize=9, colors=ORANGE)
    ax2.spines['top'].set_edgecolor(ORANGE)
    ax2.set_xlim(0, 1.15)

    ax.set_title('Genuine tipping rate by network topology', fontsize=11)
    plt.tight_layout()
    out = FIGURES / 'fig4_topology_dependence.png'
    plt.savefig(out, dpi=DPI, bbox_inches='tight')
    plt.close()
    print(f"  -> {out}")


# ── Figure 5: Phase diagram (therapeutic boundary) ────────────────────────────

def fig5_phase_diagram():
    print("Figure 5: phase diagram...")

    outcome_rank = {'prevention': 3, 'delay': 2, 'mixed': 1, 'partial': 1, 'ineffective': 0}

    strengths = sorted(set(g['strength'] for g in p9['grid']))
    start_ts  = sorted(set(g['start_t']  for g in p9['grid']))
    s_idx = {s: i for i, s in enumerate(strengths)}
    t_idx = {t: i for i, t in enumerate(start_ts)}

    grid_arr = np.zeros((len(start_ts), len(strengths)))
    for g in p9['grid']:
        grid_arr[t_idx[g['start_t']], s_idx[g['strength']]] = outcome_rank[g['outcome']]

    cmap = ListedColormap([GRAY, ORANGE, BLUE, GREEN])

    fig, ax = plt.subplots(figsize=(FIG_W, FIG_H))

    ds = float(strengths[1] - strengths[0])
    dt = float(start_ts[1]  - start_ts[0])
    s_edges = np.array(strengths + [strengths[-1] + ds], dtype=float) - ds / 2
    t_edges = np.array(start_ts  + [start_ts[-1]  + dt], dtype=float) - dt / 2

    ax.pcolormesh(s_edges, t_edges, grid_arr, cmap=cmap, vmin=-0.5, vmax=3.5)

    # Linear boundary: max_start_t = slope * strength + intercept
    bf = p9['boundary_fit']
    s_line = np.array([0.52, 1.0])
    t_line = bf['slope'] * s_line + bf['intercept']
    # Clip to plot range
    t_range = t_edges[-1] - t_edges[0]
    mask = (t_line >= t_edges[0]) & (t_line <= t_edges[-1])
    if mask.any():
        ax.plot(s_line[mask], t_line[mask], color='white', linewidth=2.2,
                linestyle='--', label=f'Boundary  R²={bf["r2"]:.2f}')
    else:
        ax.plot(s_line, t_line, color='white', linewidth=2.2,
                linestyle='--', label=f'Boundary  R²={bf["r2"]:.2f}')

    patches = [
        mpatches.Patch(color=GREEN,  label='Prevention'),
        mpatches.Patch(color=BLUE,   label='Delay'),
        mpatches.Patch(color=ORANGE, label='Partial / Mixed'),
        mpatches.Patch(color=GRAY,   label='Ineffective'),
    ]
    ax.legend(handles=patches, fontsize=8, frameon=False, loc='upper left')

    # Add boundary label
    ax.text(0.62, 0.82, 'Boundary:\nmax t = 425s - 237',
            transform=ax.transAxes, fontsize=8, color='white',
            bbox=dict(boxstyle='round,pad=0.3', fc='#333333', alpha=0.6))

    style_ax(ax, 'Therapy strength', 'Therapy start time (step)')
    ax.set_title('Therapeutic phase diagram  (config #334)', fontsize=11)

    plt.tight_layout()
    out = FIGURES / 'fig5_phase_diagram.png'
    plt.savefig(out, dpi=DPI, bbox_inches='tight')
    plt.close()
    print(f"  -> {out}")


# ── Figure 6: Boundary robustness across configs ──────────────────────────────

def fig6_boundary_robustness():
    print("Figure 6: boundary robustness scatter...")

    measurable = [(cr['config_id'],
                   cr['boundary']['slope'],
                   cr['boundary']['intercept'])
                  for cr in p10['config_results'] if cr['boundary']['slope'] > 10]
    flat = [(cr['config_id'],
             cr['boundary']['slope'],
             cr['boundary']['intercept'])
            for cr in p10['config_results'] if cr['boundary']['slope'] <= 10]

    def log_agg(cid):
        return math.log10(rm_by_id[cid]['params']['aggregationAmplification'])

    aggs_m = [log_agg(cid) for cid, _, _ in measurable]
    slopes = [s for _, s, _ in measurable]
    ints_m = [i for _, _, i in measurable]

    aggs_f = [log_agg(cid) for cid, _, _ in flat]
    ints_f = [i for _, _, i in flat]

    r_slope = pearson_r(aggs_m, slopes)
    r_int   = pearson_r(aggs_m + aggs_f, ints_m + ints_f)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(FIG_W, FIG_H))

    # Left: slope vs aggAmp
    ax1.scatter(aggs_m, slopes, color=BLUE, s=45, alpha=0.85, zorder=3,
                label=f'Measurable  n={len(measurable)}')
    ax1.scatter(aggs_f, [0] * len(aggs_f), color=GRAY, s=55, alpha=0.85,
                marker='x', linewidths=1.8, zorder=3, label='Flat (always preventable)')
    ax1.text(0.97, 0.97, f'r = {r_slope:.3f}', transform=ax1.transAxes,
             ha='right', va='top', fontsize=9)
    style_ax(ax1, 'log₁₀(aggAmp)', 'Boundary slope')
    ax1.legend(fontsize=8, frameon=False)
    ax1.set_title('A  Slope vs. aggAmp', fontsize=11, loc='left')

    # Right: intercept vs aggAmp
    ax2.scatter(aggs_m, ints_m, color=RED, s=45, alpha=0.85, zorder=3,
                label='Measurable')
    ax2.scatter(aggs_f, ints_f, color=GRAY, s=55, alpha=0.85,
                marker='x', linewidths=1.8, zorder=3, label='Flat')
    ax2.text(0.97, 0.97, f'r = {r_int:.3f}', transform=ax2.transAxes,
             ha='right', va='top', fontsize=9)
    style_ax(ax2, 'log₁₀(aggAmp)', 'Boundary intercept')
    ax2.legend(fontsize=8, frameon=False)
    ax2.set_title('B  Intercept vs. aggAmp', fontsize=11, loc='left')

    plt.tight_layout()
    out = FIGURES / 'fig6_boundary_robustness.png'
    plt.savefig(out, dpi=DPI, bbox_inches='tight')
    plt.close()
    print(f"  -> {out}")


# ── Figure 7: Disease subtype scatter ─────────────────────────────────────────

def fig7_subtypes():
    print("Figure 7: disease subtypes scatter...")

    labels_2   = p12['kmeans']['labels_by_k']['2']
    config_ids = p12['config_ids']

    agg_vals, tip_vals, cl_labels = [], [], []
    for cid, lbl in zip(config_ids, labels_2):
        cfg = rm_by_id.get(cid)
        p7b_cfg = p7b_by_id.get(cid)
        if cfg is None or p7b_cfg is None:
            continue
        agg_vals.append(cfg['params']['aggregationAmplification'])
        tip_vals.append(p7b_cfg['tip_median'])
        cl_labels.append(lbl)

    agg_arr = np.array(agg_vals)
    tip_arr = np.array(tip_vals)
    cl_arr  = np.array(cl_labels)

    fig, ax = plt.subplots(figsize=(FIG_W, FIG_H))

    for cl, color, name in [(0, BLUE, 'Slow-tipping  (Cluster 0)'),
                             (1, RED,  'Fast-tipping  (Cluster 1)')]:
        m = cl_arr == cl
        ax.scatter(np.log10(agg_arr[m]), tip_arr[m], color=color,
                   s=20, alpha=0.65, label=name)

    # Cluster centroids
    for cl_data in p12['clusters']:
        cl  = cl_data['cluster']
        col = BLUE if cl == 0 else RED
        mean_agg = cl_data['mean_features']['aggregationAmplification']
        mean_tip = cl_data['mean_features']['tipping_step']
        ax.scatter(math.log10(mean_agg), mean_tip, color=col,
                   s=180, marker='*', zorder=6, edgecolors='white', linewidths=0.8)

    style_ax(ax, 'log₁₀(aggregationAmplification)', 'Tipping step')
    ax.legend(fontsize=9, frameon=False)
    ax.set_title('Disease subtype clusters  (247 genuine configs, K=2)', fontsize=11)
    ax.text(0.97, 0.97, f'n={len(agg_vals)}  aggAmp predicts {84.6}%',
            transform=ax.transAxes, ha='right', va='top', fontsize=8)

    plt.tight_layout()
    out = FIGURES / 'fig7_subtype_scatter.png'
    plt.savefig(out, dpi=DPI, bbox_inches='tight')
    plt.close()
    print(f"  -> {out}")


# ── Figure 8: Bootstrap stability ─────────────────────────────────────────────

def fig8_bootstrap():
    print("Figure 8: bootstrap stability histogram...")

    dist = p12['bootstrap']['stability_distribution']
    bins = list(dist.keys())
    vals = [dist[b] * 100 for b in bins]

    extreme_bins = {'0.0-0.2', '0.8-1.0'}
    colors = [GREEN if b in extreme_bins else ORANGE for b in bins]

    fig, ax = plt.subplots(figsize=(FIG_W, FIG_H))
    x = np.arange(len(bins))
    bars = ax.bar(x, vals, color=colors, alpha=0.85, width=0.55)

    ax.set_xticks(x)
    ax.set_xticklabels(bins, fontsize=9)
    style_ax(ax, 'Bootstrap stability score', 'Pairs (%)')
    ax.set_title('Bootstrap stability distribution  (K=2 clustering, 100 resamples)', fontsize=11)

    total_extreme = sum(v for b, v in zip(bins, vals) if b in extreme_bins)
    ax.text(0.5, 0.96,
            f'{total_extreme:.1f}% of pairs at extreme stability (bimodal)',
            transform=ax.transAxes, ha='center', va='top', fontsize=9)

    # Annotate each bar
    for bar, v in zip(bars, vals):
        if v > 1:
            ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.3,
                    f'{v:.1f}%', ha='center', fontsize=8)

    plt.tight_layout()
    out = FIGURES / 'fig8_bootstrap_stability.png'
    plt.savefig(out, dpi=DPI, bbox_inches='tight')
    plt.close()
    print(f"  -> {out}")


# ── Figure 9: Robustness hierarchy ────────────────────────────────────────────

def fig9_robustness():
    print("Figure 9: robustness hierarchy...")

    bl_genuine = p14['baseline']['genuine_rate']
    bl_coh     = p14['baseline']['coh_r_mean']
    bl_rank    = 1.0   # baseline: configs ranked against themselves

    ed_results = p14['perturbations']['edge_dropout']['results']
    vn_results = p14['perturbations']['vuln_noise']['results']

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(FIG_W, FIG_H), sharey=True)

    panels = [
        (ax1, ed_results, 'Edge dropout fraction',    'A  Edge dropout'),
        (ax2, vn_results, 'Vulnerability noise sigma', 'B  Vulnerability noise'),
    ]

    for ax, results, xlabel, title in panels:
        levels    = [r['level']              for r in results]
        gen_rates = [r['genuine_rate']       for r in results]
        coh_means = [r['coh_r_mean']         for r in results]
        rank_rs   = [r['subtype_spearman_r'] for r in results]

        x_all    = [0.0] + levels
        gen_all  = [bl_genuine] + gen_rates
        coh_all  = [bl_coh]     + coh_means
        rank_all = [bl_rank]    + rank_rs

        ax.plot(x_all, gen_all,  color=RED,    linewidth=2,   marker='o', ms=6,
                label='Genuine tipping rate')
        ax.plot(x_all, coh_all,  color=BLUE,   linewidth=2,   marker='o', ms=6,
                markerfacecolor='none', label='Mean coherence r')
        ax.plot(x_all, rank_all, color=GREEN,  linewidth=2,   marker='^', ms=6,
                label='Subtype rank r')

        # Breaking threshold dashed lines
        ax.axhline(0.5, color=RED,   linestyle=':', linewidth=1.2, alpha=0.55)
        ax.axhline(0.3, color=BLUE,  linestyle=':', linewidth=1.2, alpha=0.55)

        ax.set_ylim(-0.08, 1.1)
        style_ax(ax, xlabel, 'Score' if ax is ax1 else '')
        ax.set_title(title, fontsize=11, loc='left')

        if ax is ax1:
            ax.legend(fontsize=8, frameon=False, loc='lower left')

    plt.tight_layout()
    out = FIGURES / 'fig9_robustness_hierarchy.png'
    plt.savefig(out, dpi=DPI, bbox_inches='tight')
    plt.close()
    print(f"  -> {out}")


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    print("Generating 9 paper figures...\n")
    fig1_supplementary()
    fig2_triphasic()
    fig3_null_model()
    fig4_topology()
    fig5_phase_diagram()
    fig6_boundary_robustness()
    fig7_subtypes()
    fig8_bootstrap()
    fig9_robustness()
    print("\nDone. All figures saved to figures/")
