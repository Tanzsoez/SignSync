# SignSync

SignSync is an on-device React/Vite ASL and FSL translator. Recognition uses a
hybrid architecture so static handshapes do not compete with conversational
motion sequences.

## Recognition architecture

```text
Static mode
  Webcam -> MediaPipe Holistic hand -> 72 handshape features
  -> MLP(96, 64) -> dialect filter -> temporal confirmation

Phrase mode
  Webcam -> MediaPipe Holistic hands + pose -> 168 features/frame
  -> motion-aware gesture completion -> temporal resampling to 60 frames
  -> GRU(48) + Dense(40) -> dialect filter -> confidence gate
```

The live app and the recording studio both use MediaPipe Holistic. This avoids
mixing coordinates from different landmark models. Only a newly returned
Holistic result is queued, so a fast display refresh cannot duplicate stale
frames. Phrase inference runs once after motion ends, a 60-frame maximum is
reached, or the hands leave view. This prevents incomplete prefixes from being
committed as another phrase. Completed partial gestures are linearly resampled
to the model's 60-frame input.

Both recognizers score the observed landmarks together with an anatomically
mirrored copy and average their logits. The result is explicitly invariant to
left- versus right-hand signing. Recovered hand landmarks are used only through
short dropouts; when the opposite hand becomes live, the recovered hand is
excluded so a hand switch cannot be mistaken for a two-handed phrase. Hands,
pose/chest anchors, and face landmarks use stream-specific adaptive smoothing.

Known close phrase pairs also pass through a conservative biomechanical check
after neural inference. Wrist-relative finger extension confirms Thank You,
Mahal Kita, Magandang Gabi, and Good Afternoon only when the neural result is
the specific confusable counterpart; this check is identical for left and
right hands and does not rewrite unrelated predictions. Known look-alike
families also require a wider confidence margin when no physical check resolves
the ambiguity.

The static and dynamic TensorFlow models begin loading after the Home page's
first render. A single dedicated Web Worker owns both warmed model instances,
so Translator and Learning Center share the runtime without running TensorFlow
on the rendering thread. Versioned service-worker caches keep the application
shell and model packages available after the first successful load. MediaPipe
assets used from jsDelivr are runtime-cached after their first successful use.
The 3D signer is loaded separately only when its view is opened.
For trained signs, the signer loads `public/models/avatar_poses.json`, a compact
library of actual representative landmarks exported from the same static and
dynamic recordings used by the classifiers. Handshape, handedness, spacing,
body-relative placement, and motion therefore come from recorded examples;
handwritten poses are retained only as an explicit load-failure fallback.

## Existing datasets

- `dataset_holistic.json`: 730 static clips, each shaped `(30, 72)`, across 73
  ASL/FSL labels.
- `dataset_dynamic_v2.json`: 441 dynamic clips, each shaped `(60, 168)`, across
  44 conversational labels.

Two complete recordings per label are held out before augmentation. Static
training uses individual recorded frames with mirrored-hand and light-noise
augmentation. Dynamic training uses the native Holistic sequences, correct
anatomical left/right mirroring, light landmark noise, and randomized timing,
leading holds, trailing holds, and camera-frame drops.

## Train and export

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-training.txt
python -m pip install --no-deps -r requirements-export.txt

npm install
npm run audit-holistic
npm run audit-dynamic-v2
npm run preprocess-models
npm run train-models
npm run export-models
```

`export-models` also regenerates the recorded avatar-pose library. It can be
rebuilt independently after dataset changes with `npm run export-avatar-poses`.

`export-models` creates separate uint8 weight-quantized TensorFlow.js packages
in `public/models/static_mlp` and `public/models/dynamic_gru`. Activations remain
floating point in the browser.

## Development and validation

```powershell
npm run dev
npm run lint
npm test
npm run build
npm run test:bundle-budget
```

The tests verify sequence resampling, completion-based gesture segmentation,
and execution of both quantized web models. Offline metrics use independent
held-out recordings and browser-style shortened/held sequence replay with the
same ASL/FSL dialect filtering used by the app. Real webcam testing remains
necessary because the recordings come from a limited number of users and
environments.

Current internal results and their limitations are published in
[MODEL_CARD.md](MODEL_CARD.md) and on the Home page. These figures are not an
independent signer study. Learning Center photographs must be consented,
licensed, and reviewed by Deaf ASL or FSL signers before being registered in
`src/data/verifiedSignReferences.js`; existing vector artwork is labelled as an
illustration pending photo review.

For mobile testing, deploy a preview and open
`?diagnostics=1#translator`. Follow [MOBILE_VALIDATION.md](MOBILE_VALIDATION.md)
for the device matrix, latency targets, accuracy recording, soak test, and
release gate. Camera Performance mode can be selected in Settings; Auto is the
default and adapts submission cadence from measured MediaPipe latency.
