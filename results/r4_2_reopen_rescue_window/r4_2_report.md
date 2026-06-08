# Phase R4.2 -- Reopening the Rescue Window via ATP Restoration

> **Disclaimer**: All results are specific to the v2.0 DecoupledSimulator
> (C. elegans motor connectome). ATP restoration is a model intervention
> and does NOT represent any specific real-world therapy, drug, or
> clinical protocol. This is hypothesis-generating only.

## Summary

- **Verdict**: DESIGN LIMITATION CONFIRMED (see below)
- **Max tipping rate reduction**: 0.000 pp (from 1.000 at 0% to 1.000 at 100%)
- **ATP50_recovery**: not reached
- **Rescue reopened**: False
- **Benefit gain** (100% vs 0% restore): -0.002

## DESIGN LIMITATION CONFIRMED

This experiment reveals a known architectural constraint of the current model:
the aggregation growth equation (`d_agg`) has **no ATP feedback term** (`simulator.py`
lines 97–100):

```python
d_agg = (self.vulnerability * self.AGG_SEED_RATE * dt
         + self.AGG_SPREAD_RATE * agg_spread * dt
         + noise)
```

ATP restoration cannot slow aggregation because the aggregation equation is
**ATP-independent by design**. The null result is therefore an expected consequence
of model architecture, not a biological finding.

**This result does not establish that ATP is a marker in biological ALS.** It
establishes that ATP cannot rescue the cascade in a model where aggregation is
self-driving. A model with bidirectional coupling — e.g. a chaperone term
`−CHAPERONE_RATE × atp × agg` in `d_agg` — would produce a qualitatively
different outcome.

**R4.1 timing cliff remains valid**: it reflects genuine nonlinear dynamics
of the cascade under the current model architecture. R4.2 should not be
cited as a mechanistic finding.

Future versions should implement bidirectional coupling: `d_agg` should include
a term proportional to ATP-dependent chaperone activity
(`−CHAPERONE_RATE * atp * agg`).

## Scientific Question

R4.1 found that mean ATP at intervention time is the strongest predictor
of rescue failure (r = -0.77). R4.2 was intended to test whether ATP depletion
is causal or correlational. **The experiment is underpowered to answer this
question** because the current model architecture prevents ATP from influencing
aggregation by design. The question remains open and requires a model revision
before it can be tested.

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

**Result: NOT APPLICABLE** — the classification criteria assume the model
has ATP feedback on aggregation. Because `d_agg` is ATP-independent by design,
no restoration level can separate "marker" from "bottleneck" in the current
architecture. Applying the criteria would produce a misleading "MARKER_ONLY"
label that carries unwarranted biological interpretation.

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

## Key Questions — Status After Audit

1. **Can ATP restoration reopen the rescue window?**
   Unanswerable with current model. The null result reflects the absence of
   ATP feedback in `d_agg`, not a biological property of the cascade.

2. **Is ATP depletion causal or merely correlated?**
   Unanswerable with current model. A model without ATP feedback on aggregation
   cannot distinguish these two hypotheses. Requires v3.0 with chaperone kinetics.

3. **Is there an ATP rescue threshold?**
   Unanswerable with current model for the same reason.

4. **What does the R4.2 result validly show?**
   That `sim.atp` modification at T=150 has no downstream path to `d_agg` in the
   current architecture. This is a model audit finding, not a cascade dynamics finding.

5. **Should R4.2 be cited alongside R3.9 and R4.1?**
   No. R3.9 (potency cliff) and R4.1 (timing cliff) reflect genuine emergent
   nonlinear dynamics. R4.2 reflects a missing model term. They are not comparable.

## Limitations

- **Primary limitation**: `d_agg` has no ATP feedback term (`simulator.py` lines
  97–100). ATP restoration experiments are uninformative about the causal role
  of ATP until this is addressed in a future model version.
- ATP restoration is a model-level state modification, NOT a representation
  of any real therapeutic intervention.
- R4.2 should not be cited as a biological or mechanistic finding.
- R4.1 results are unaffected by this limitation; the timing cliff is a valid
  emergent property of the current model dynamics.
- Not peer-reviewed.

*Generated: Phase R4.2 | Runtime: 45.5s*