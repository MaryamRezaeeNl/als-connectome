# Phase R4.1 — Dynamic Therapeutic Window & Late Rescue

> **Disclaimer**: All results are specific to the computational v2.0 model.
> This is hypothesis-generating only and does not constitute clinical evidence.

## Summary

- **Verdict**: NARROW_RESCUE_WINDOW
- **T50_rescue**: 73.3 steps [64, 81] (onset at which 50% of therapeutic benefit is lost)
- **Point of no return**: step 100
- **Rescue shape**: CLIFF-LIKE (max step-change 0.416 at T=75->T=100)
- **Best predictor of rescue failure**: mean_atp (r=-0.768)

## Design

- Base context: ISR=2.0, TSSE=2.0 (100% genuine tipping at T=0 with no therapy)
- Therapy: 90% coupled suppression (ISR=0.20, TSSE=0.20) — strongest from R3.10
- T_start sweep: [0, 25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 300]
- N=50 seeds per onset, 500 steps, 1000 bootstrap resamples
- Total runs: 600 (+50 baseline)

## Baseline (no therapy)

| Metric | Value |
|---|---|
| Genuine tipping rate | 1.000 |
| First death step (mean) | 167.4 |
| Plateau survivors (mean) | 9.4 |
| Functional survival (mean) | 224.2 |

## Rescue Dose-Response

| T_start | Genuine rate | 95% CI | Benefit | Plateau | Func. survival |
|---|---|---|---|---|---|
| 0 | 0.000 | [0.000, 0.000] | 0.961 | 53.0 | 500.0 |
| 25 | 0.040 | [0.000, 0.100] | 0.910 | 45.7 | 500.0 |
| 50 | 0.200 | [0.100, 0.300] | 0.720 | 32.9 | 494.0 |
| 75 | 0.522 | [0.380, 0.660] | 0.454 | 24.1 | 419.8 |
| 100 | 0.938 | [0.860, 1.000] | 0.181 | 19.4 | 340.0 |
| 125 | 0.979 | [0.940, 1.000] | 0.095 | 16.2 | 292.3 |
| 150 | 1.000 | [1.000, 1.000] | 0.047 | 14.8 | 255.0 |
| 175 | 1.000 | [1.000, 1.000] | 0.027 | 13.4 | 235.5 |
| 200 | 1.000 | [1.000, 1.000] | 0.019 | 12.3 | 228.4 |
| 225 | 1.000 | [1.000, 1.000] | 0.013 | 11.8 | 223.4 |
| 250 | 1.000 | [1.000, 1.000] | 0.014 | 11.7 | 224.4 |
| 300 | 1.000 | [1.000, 1.000] | 0.007 | 10.5 | 224.3 |

## State at Intervention Time

| T_start | Alive | Dead | Irrev. | Mean agg | Mean ATP | Mean tox | Coherence r |
|---|---|---|---|---|---|---|---|
| 0 | 61 | 0.0 | 0.0 | 0.004 | 1.000 | 0.000 | 0.000 |
| 25 | 61 | 0.0 | 0.0 | 0.028 | 0.987 | 0.000 | 0.000 |
| 50 | 61 | 0.0 | 0.0 | 0.056 | 0.964 | 0.002 | 0.000 |
| 75 | 61 | 0.0 | 0.0 | 0.089 | 0.934 | 0.004 | 0.000 |
| 100 | 61 | 0.0 | 0.0 | 0.130 | 0.897 | 0.007 | 0.000 |
| 125 | 61 | 0.0 | 0.0 | 0.181 | 0.851 | 0.011 | 0.000 |
| 150 | 61 | 0.0 | 0.0 | 0.246 | 0.791 | 0.017 | 0.000 |
| 175 | 59 | 2.4 | 0.0 | 0.302 | 0.737 | 0.023 | 0.044 |
| 200 | 46 | 15.1 | 0.0 | 0.286 | 0.743 | 0.025 | -0.465 |
| 225 | 30 | 30.9 | 0.1 | 0.208 | 0.807 | 0.020 | -0.407 |
| 250 | 25 | 35.9 | 0.1 | 0.186 | 0.822 | 0.016 | 0.170 |
| 300 | 18 | 43.2 | 0.1 | 0.131 | 0.868 | 0.006 | 0.587 |

## Feature Importance (correlation with rescue failure)

| State variable | Pearson r (with is_genuine) |
|---|---|
| mean_atp | -0.768 |
| mean_agg | +0.751 |
| network_agg_load | +0.729 |
| mean_tox | +0.682 |
| n_dead | +0.415 |
| n_irreversible | +0.099 |
| coherence_r_at_t | -0.013 |

Best predictor: **mean_atp** (r=-0.768).

## Comparison with R3.9 (Potency vs Timing)

R3.9 required **96.5% ISR suppression** (at T=0) to achieve 50% tipping reduction.
R4.1 shows rescue fails at **T~73 steps** even with 90% coupled suppression.

Within this computational framework, both potency and timing impose independent constraints on therapeutic efficacy. The R3.9 cliff (95% potency required) and the R4.1 timing cliff (T~73 steps) together define a two-dimensional therapeutic constraint surface.

## Key Questions Addressed

1. **Does a critical rescue window exist?** Yes — within this computational framework.
2. **Point of no return?** Step 100.
3. **Best predictor of rescue failure?** mean_atp (r=-0.768). This is a model-internal finding.
4. **Rescue before first neuron dies?** Baseline first death at step ~167. T50_rescue at step ~73 — rescue fails BEFORE the first neuron dies, supporting the pre-symptomatic window concept.
5. **Timing vs potency?** Both are necessary but independent constraints within this model. Neither alone is sufficient — near-complete suppression applied too late still fails; early intervention with insufficient potency also fails (R3.9).
6. **Pre-symptomatic window?** The model supports the concept: rescue probability is highest at T=0 and declines steadily thereafter. All results are hypothesis-generating only.

## Limitations

- All findings are specific to this computational model and parameter set.
- The 90% coupled suppression therapy is a model construct without a direct biological equivalent.
- The 'point of no return' is a model threshold, not a biological prediction.
- Results do not account for pharmacokinetics, drug distribution, or off-target effects.
- Not peer-reviewed. Not a clinical model.

*Generated: Phase R4.1 | Runtime: 54.8s*