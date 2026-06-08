# Phase R4.2 -- Reopening the Rescue Window via ATP Restoration

> **Disclaimer**: All results are specific to the v2.0 DecoupledSimulator
> (C. elegans motor connectome). ATP restoration is a model intervention
> and does NOT represent any specific real-world therapy, drug, or
> clinical protocol. This is hypothesis-generating only.

## Summary

- **Verdict**: ATP_IS_MARKER
- **ATP role**: MARKER_ONLY
- **Max tipping rate reduction**: 0.000 pp (from 1.000 at 0% to 1.000 at 100%)
- **ATP50_recovery**: not reached (>100%)
  — restoration strength needed for 50% genuine tipping rate at T=150
- **Rescue reopened** (genuine rate <= 0.50 at 100% restore): False
- **PONR defeated** (>10 pp improvement at 100% restore): False
- **Benefit gain** (100% vs 0% restore): -0.002

## Scientific Question

R4.1 found that mean ATP at intervention time is the strongest predictor
of rescue failure (r = -0.77). R4.2 tests whether ATP depletion is:
- **Causal** (a bottleneck that, if reversed, re-opens the rescue window), OR
- **Correlational** (a marker of other irreversible damage that cannot be undone)

## System State at T=150

| Metric | Value |
|---|---|
| Mean ATP at T=150 | 0.793 |
| Neurons irreversible (atp<0.30 AND agg>0.70) | 0.0 |
| Neurons eligible for ATP restoration | 61.0 |
| Irreversibility cap | ATP capped at 0.225 each step |

## ATP Restoration Implementation

- **Formula**: `sim.atp[eligible] += strength * (1.0 - sim.atp[eligible])`
- **Eligibility**: neurons that are alive (health > 0.15) AND not flagged irreversible
- **Applied at**: simulation step T=150 (after T-1 normal steps, before step T continues)
- **Combined with**: 90% coupled ISR+TSSE suppression (same as R4.1)

**Irreversibility interaction**: The DecoupledSimulator enforces an irreversibility
condition: if `ATP < atpCollapseThreshold (0.30) AND agg > recoveryIrreversibility (0.70)`,
neurons are permanently flagged. Their ATP is capped at `0.225` every subsequent step,
and health cannot recover. ATP restoration DOES modify `sim.atp` for these neurons
immediately, but the cap is re-applied in the next `step()` call.

**Alternative implementation considered**: Increasing `ATP_RECOVERY` rate temporarily.
Not used because it would require modifying a class constant (`self.ATP_RECOVERY = 0.04`)
and is less biologically interpretable. The direct state modification is cleaner.

**ATP decay dynamics**: With `ATP_RECOVERY = 0.04/step`, a full restore (ATP = 1.0)
decays back toward equilibrium (~0.729 at mean agg=0.246) over ~30-50 steps.
During this window, oxidative stress (ox) is reduced via `d_ox = 0.15*cal - 0.04*atp*ox`
and toxicity clearance is enhanced via `CLEARANCE_BASE * atp * tox`.

## Results

| Restore % | Genuine rate | 95% CI | Benefit | Plateau | ATP delta |
|---|---|---|---|---|---|
| 0% | 1.000 | [1.000, 1.000] | 0.049 | 14.8 | +0.000 |
| 10% | 1.000 | [1.000, 1.000] | 0.047 | 14.6 | +0.021 |
| 20% | 1.000 | [1.000, 1.000] | 0.046 | 14.6 | +0.042 |
| 30% | 1.000 | [1.000, 1.000] | 0.046 | 14.6 | +0.062 |
| 40% | 1.000 | [1.000, 1.000] | 0.047 | 14.6 | +0.084 |
| 50% | 1.000 | [1.000, 1.000] | 0.050 | 14.4 | +0.103 |
| 60% | 1.000 | [1.000, 1.000] | 0.048 | 14.7 | +0.124 |
| 70% | 1.000 | [1.000, 1.000] | 0.050 | 14.4 | +0.143 |
| 80% | 1.000 | [1.000, 1.000] | 0.050 | 14.8 | +0.165 |
| 90% | 1.000 | [1.000, 1.000] | 0.046 | 14.5 | +0.188 |
| 100% | 1.000 | [1.000, 1.000] | 0.047 | 14.3 | +0.209 |

## Derived Analyses

### 1. Rescue Reopening Curve
Genuine tipping rate decreases from 1.000 (0% restore, control) to
1.000 (100% restore). Max gain = 0.000 pp.

### 2. ATP50_recovery
The restoration strength at which genuine tipping rate reaches 50%: **not reached** (>100%).
This is the 'half-efficacy' threshold for ATP restoration at this onset time,
analogous to ISR50 in R3.9.

### 3. Point of No Return Test
Control (0% restore) at T=150: genuine rate = 1.000
Full restore (100%) at T=150: genuine rate = 1.000
PONR defeated (>10 pp improvement): **False**

### 4. Mechanistic Classification
Max genuine rate reduction = 0.000 pp across all restoration levels.

Criteria (model-internal):
- >= 50 pp reduction: ATP is DOMINANT_BOTTLENECK
- 10-50 pp reduction: ATP is PARTIAL_BOTTLENECK
- < 10 pp reduction: ATP is MARKER_ONLY

**Result: MARKER_ONLY**

### 5. Comparison with R4.1 + Mechanistic Reanalysis

R4.1 showed that at T=150 (after PONR), coupled therapy alone yields
genuine rate = 1.000. Adding ATP restoration at 100% strength yields
genuine rate = 1.000 — zero improvement.

**Mechanistic explanation (within this model):**

ATP depletion is a downstream consequence of aggregation accumulation, not an
independent state variable. The simulator enforces:

    atp_target = 1 - ATP_DAMAGE_SCALE * mitFrag * agg = 1 - 1.10 * 1.0 * 0.246 = 0.729

With ATP_RECOVERY = 0.04/step, restored ATP decays back toward 0.729 over
the next 30-50 steps regardless of the initial boost. The accumulated aggregation
(0.246 mean at T=150) immediately re-suppresses ATP.

Critically, the aggregation equation has **no decay term**:

    d_agg = vuln * AGG_SEED_RATE * ISR + SPREAD_RATE * TSSE * agg_spread + oxFeedback * ox

Even with ISR=0.20 and TSSE=0.20 (90% suppression), existing aggregation (0.246)
continues to spread trans-synaptically and drive new seeding. The cascade has
already passed the self-sustaining threshold by T=150.

**Implication for R4.1's ATP predictor:** Mean ATP at T_start (r=-0.77) was a proxy
for mean aggregation at T_start (via atp = 1 - scale*agg + lag). The true causal
predictor of rescue failure is accumulated aggregation, not ATP depletion.

## Key Questions Answered

1. **Can ATP restoration reopen the rescue window?**
   No — zero improvement across all 11 restoration levels (0% to 100%).
   The rescue window cannot be reopened by ATP restoration alone at T=150.

2. **Is ATP depletion causal or merely correlated?**
   Within this model: **MARKER ONLY**. ATP depletion is a downstream proxy for
   accumulated aggregation. Restoring ATP without removing accumulated aggregation
   has no effect on cascade outcome.

3. **Is there an ATP rescue threshold?**
   Not applicable — even 100% restore yielded zero gain. No threshold exists
   within the tested range.

4. **How much rescue potential can be recovered?** Zero within this model.
   The true barrier to late rescue is accumulated aggregation, which this
   intervention does not address.

5. **Does ATP act as the final bottleneck?**
   No. Within this model, ATP is a passive readout of aggregation state.
   The final bottleneck is accumulated aggregation (no decay term in model),
   which continues driving the cascade even after ATP is restored and therapy applied.

## Limitations

- ATP restoration is a model-level state modification, NOT a representation
  of any real therapeutic intervention (mitochondrial rescue, NAD+ repletion, etc.).
- The irreversibility cap (0.225) prevents full benefit for already-flagged neurons.
- No pharmacokinetics, drug distribution, or off-target effects are modeled.
- The C. elegans motor circuit is a simplified substrate; results may not
  generalize to mammalian disease biology.
- Not peer-reviewed. Results are hypothesis-generating computational observations.

*Generated: Phase R4.2 | Runtime: 45.5s*