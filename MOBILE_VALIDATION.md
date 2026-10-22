# Mobile validation protocol

Use a Vercel Preview deployment for physical-device testing. Add
`?diagnostics=1#translator` to the URL to display the live runtime panel. The
panel contains timing and device-class information only; it never records or
uploads camera frames or landmarks.

## Required device matrix

Test at least one device in every row:

| Class | Browser | Orientation |
| --- | --- | --- |
| Low-range Android | Chrome | Portrait and landscape |
| Mid-range Android | Chrome or Samsung Internet | Portrait and landscape |
| Recent Android | Chrome | Portrait |
| iPhone | Safari | Portrait and landscape |
| Laptop reference | Chrome | Landscape |

Repeat the static and phrase suites in bright, dim, and backlit conditions.

## Runtime acceptance criteria

- Landmark age p95 is at most 250 ms on supported mid-range phones.
- Static output appears within 500 ms after the sign becomes stable.
- Phrase output appears within 800 ms after gesture completion.
- No processing backlog grows during a 30-minute camera session.
- The camera session does not freeze, reload, or show sustained thermal
  degradation.
- Mobile macro-F1 is within three percentage points of the laptop reference.
- No supported sign has an unexplained mobile accuracy loss above five points.

If `holisticLatencyMs` is consistently above 250 ms, test Performance mode in
Settings. If latency is below 180 ms but pose quality is poor, test Accuracy
mode. Restart the camera after changing modes.

## Accuracy capture

For every device, record the expected label, predicted label, confidence,
orientation, lighting condition, and whether the result was accepted. Keep
users separated when creating train and holdout splits. Never place recordings
from the same person and session in both sets.

Retraining is required only if the time-invariant pipeline still misses the
acceptance criteria. Mobile recordings must be collected with explicit consent
and reviewed before they are added to the training dataset.

## Release gate

Run `npm run verify`, complete the physical-device matrix, and deploy first to
a small Vercel Preview audience. Promote the exact tested build to production;
roll back the deployment and model manifest if either latency or per-sign
accuracy regresses.
