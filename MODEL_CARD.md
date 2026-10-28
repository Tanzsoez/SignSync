# SignSync model card

## Scope

SignSync uses a 17,961-parameter static MLP for 73 ASL/FSL letter and number
labels and a 35,012-parameter GRU for 44 conversational motion labels. Both
models run locally in a dedicated browser worker. Predictions are filtered by
the selected dialect, confidence, top-two margin, temporal confirmation, and
known-confusion checks.

## Current internal results

| Model | Held-out recordings | Accuracy | Macro-F1 | Timing-robust accuracy |
| --- | ---: | ---: | ---: | ---: |
| Static MLP | 146 | 100.00% | 100.00% | Not measured |
| Dynamic GRU | 88 | 97.73% | 97.58% | 96.59% |

The dynamic training-machine inference p95 was 85.097 ms. This is not a mobile
browser measurement. `ASL_ME` and `FSL_AKO_AY_MABUTI` each scored 50% on their
two-recording validation samples and require targeted data collection.

## Important limitations

- These results use only two held-out recordings per label.
- The current recordings come from a limited signer population.
- The report is not an independent Deaf signer study and must not be marketed
  as real-world accuracy.
- Accuracy can change with signer, camera, lighting, background, motion speed,
  device performance, and dialect variation.
- Browser speech recognition is separate from these sign-recognition models
  and may depend on an online browser service.

## Required release evidence

Future claims must use signer-separated and session-separated test data, report
per-label precision/recall/F1, confusion matrices, rejection coverage, device
latency, and confidence intervals, and include review by Deaf ASL and FSL
signers. Thresholds must be tuned on validation data, never on the frozen test
set.

The machine-readable snapshot exposed by the app is
`public/accuracy-report.json`.
