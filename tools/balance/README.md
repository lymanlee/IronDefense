# Balance Tools

This folder contains the project-side balance simulator and trace comparison tools.

## Calibration Semantics

There are two baseline semantics in this project. They are intentionally different.

- `lab_baseline`
  The real runtime trace captured from the game under deterministic auto-sweep behavior.
  This is useful for verifying that a code change did not accidentally break the baseline experiment setup.

- `player_proxy`
  The simulator result from `simulateBaselineCalibration(...)`.
  This is used for balance tuning and is allowed to be slightly optimistic relative to the lab baseline.
  Reason: a real player can prioritize frontline enemies better than the left-right constant-speed sweep used by the lab experiment.

## Practical Reading Rule

- For `baseline_calibration`:
  Prefer near-alignment. Small drift is acceptable.

- For `baseline_parallel`:
  Moderate optimism is acceptable.
  Parallel fire benefits more from real player target prioritization than from the deterministic sweep experiment.

- For `baseline_serial`:
  Keep it closer than parallel fire, because its gain mostly comes from extra follow-up shots rather than wider target coverage.

## Current Debug Modes

The debug screen exposes three baseline-oriented modes when `wave=0`.

- `baseline_calibration`
  Base single-shot lab baseline.

- `baseline_parallel`
  Adds `bonusSpreadCount=1` on top of the base profile.

- `baseline_serial`
  Adds `bonusMultiShot=1` on top of the base profile.

Each finished run emits a browser log line starting with `[BaselineTraceSummary]`.
That log is the preferred source when comparing real runs against the simulator.

## Recommended Workflow

1. Run a real baseline mode in the game until failure.
2. Read the latest `[BaselineTraceSummary]` from browser logs.
3. Compare it with `tools/balance/baseline_trace_compare.js`.
4. Interpret the delta with the rule above:
   runtime trace is `lab_baseline`, simulator output is `player_proxy`.

## Important Caveat

Do not force the simulator to exactly match the lab baseline in every case.
If a change makes the simulator slightly optimistic but still more representative of real player behavior, keep the simulator optimistic and document the reason.
