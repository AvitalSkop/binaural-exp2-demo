# Listening examples

Selected examples (valsep64, 160,000 training steps); not representative of average performance.
Stereo 16 kHz WAV (left, right); all signals of an example share one gain. Interactive version: https://avitalskop.github.io/binaural-exp2-demo/

Metrics: binaural (both ears jointly), against the near-anechoic image of the requested speaker; SI metrics in dB.
Development (cross-validation) split: speakers seen during training, unseen utterances and room. No held-out test results.

## 041: Clear extraction of both speakers

Both target speakers are extracted clearly, with little audible residual interference.

s1 at +10°, s2 at -35°, separation 45°. Metric tables: [ex041.txt](ex041.txt)

- Requested **s1**: [Mixture](../site/audio/ex041/mixture.wav) · [Target s1 near-anechoic](../site/audio/ex041/clean_s1.wav) · [E1 Element-wise](../site/audio/ex041/E1_s1.wav) · [F FiLM](../site/audio/ex041/F_s1.wav) · [Target s1 reverberant](../site/audio/ex041/rev_s1.wav) · [Interferer s2 near-anechoic](../site/audio/ex041/clean_s2.wav) · [Interferer s2 reverberant](../site/audio/ex041/rev_s2.wav)
- Requested **s2**: [Mixture](../site/audio/ex041/mixture.wav) · [Target s2 near-anechoic](../site/audio/ex041/clean_s2.wav) · [E1 Element-wise](../site/audio/ex041/E1_s2.wav) · [F FiLM](../site/audio/ex041/F_s2.wav) · [Target s2 reverberant](../site/audio/ex041/rev_s2.wav) · [Interferer s1 near-anechoic](../site/audio/ex041/clean_s1.wav) · [Interferer s1 reverberant](../site/audio/ex041/rev_s1.wav)

## 008: Target switching at 10° separation

Target switching is achieved with only 10° angular separation, although some interference remains.

s1 at -5°, s2 at +5°, separation 10°. Metric tables: [ex008.txt](ex008.txt)

- Requested **s1**: [Mixture](../site/audio/ex008/mixture.wav) · [Target s1 near-anechoic](../site/audio/ex008/clean_s1.wav) · [E1 Element-wise](../site/audio/ex008/E1_s1.wav) · [F FiLM](../site/audio/ex008/F_s1.wav) · [Target s1 reverberant](../site/audio/ex008/rev_s1.wav) · [Interferer s2 near-anechoic](../site/audio/ex008/clean_s2.wav) · [Interferer s2 reverberant](../site/audio/ex008/rev_s2.wav)
- Requested **s2**: [Mixture](../site/audio/ex008/mixture.wav) · [Target s2 near-anechoic](../site/audio/ex008/clean_s2.wav) · [E1 Element-wise](../site/audio/ex008/E1_s2.wav) · [F FiLM](../site/audio/ex008/F_s2.wav) · [Target s2 reverberant](../site/audio/ex008/rev_s2.wav) · [Interferer s1 near-anechoic](../site/audio/ex008/clean_s1.wav) · [Interferer s1 reverberant](../site/audio/ex008/rev_s1.wav)

## 024: FiLM compared with Concat

For target s1, the FiLM (F) estimate sounds cleaner than the Concat (C) estimate.

s1 at +5°, s2 at -10°, separation 15°. Metric tables: [ex024.txt](ex024.txt)

- Requested **s1**: [Mixture](../site/audio/ex024/mixture.wav) · [Target s1 near-anechoic](../site/audio/ex024/clean_s1.wav) · [C Concat](../site/audio/ex024/C_s1.wav) · [E1 Element-wise](../site/audio/ex024/E1_s1.wav) · [F FiLM](../site/audio/ex024/F_s1.wav) · [Target s1 reverberant](../site/audio/ex024/rev_s1.wav) · [Interferer s2 near-anechoic](../site/audio/ex024/clean_s2.wav) · [Interferer s2 reverberant](../site/audio/ex024/rev_s2.wav)
- Requested **s2**: [Mixture](../site/audio/ex024/mixture.wav) · [Target s2 near-anechoic](../site/audio/ex024/clean_s2.wav) · [C Concat](../site/audio/ex024/C_s2.wav) · [E1 Element-wise](../site/audio/ex024/E1_s2.wav) · [F FiLM](../site/audio/ex024/F_s2.wav) · [Target s2 reverberant](../site/audio/ex024/rev_s2.wav) · [Interferer s1 near-anechoic](../site/audio/ex024/clean_s1.wav) · [Interferer s1 reverberant](../site/audio/ex024/rev_s1.wav)

## 047: Reconstruction at 45° separation

FiLM (F) and Element-wise (E1) reconstruct both target speakers well.

s1 at +15°, s2 at -30°, separation 45°. Metric tables: [ex047.txt](ex047.txt)

- Requested **s1**: [Mixture](../site/audio/ex047/mixture.wav) · [Target s1 near-anechoic](../site/audio/ex047/clean_s1.wav) · [E1 Element-wise](../site/audio/ex047/E1_s1.wav) · [F FiLM](../site/audio/ex047/F_s1.wav) · [Target s1 reverberant](../site/audio/ex047/rev_s1.wav) · [Interferer s2 near-anechoic](../site/audio/ex047/clean_s2.wav) · [Interferer s2 reverberant](../site/audio/ex047/rev_s2.wav)
- Requested **s2**: [Mixture](../site/audio/ex047/mixture.wav) · [Target s2 near-anechoic](../site/audio/ex047/clean_s2.wav) · [E1 Element-wise](../site/audio/ex047/E1_s2.wav) · [F FiLM](../site/audio/ex047/F_s2.wav) · [Target s2 reverberant](../site/audio/ex047/rev_s2.wav) · [Interferer s1 near-anechoic](../site/audio/ex047/clean_s1.wav) · [Interferer s1 reverberant](../site/audio/ex047/rev_s1.wav)

## 058: Reconstruction at 70° separation

FiLM (F) and Element-wise (E1) reconstruct both target speakers well.

s1 at +50°, s2 at -20°, separation 70°. Metric tables: [ex058.txt](ex058.txt)

- Requested **s1**: [Mixture](../site/audio/ex058/mixture.wav) · [Target s1 near-anechoic](../site/audio/ex058/clean_s1.wav) · [E1 Element-wise](../site/audio/ex058/E1_s1.wav) · [F FiLM](../site/audio/ex058/F_s1.wav) · [Target s1 reverberant](../site/audio/ex058/rev_s1.wav) · [Interferer s2 near-anechoic](../site/audio/ex058/clean_s2.wav) · [Interferer s2 reverberant](../site/audio/ex058/rev_s2.wav)
- Requested **s2**: [Mixture](../site/audio/ex058/mixture.wav) · [Target s2 near-anechoic](../site/audio/ex058/clean_s2.wav) · [E1 Element-wise](../site/audio/ex058/E1_s2.wav) · [F FiLM](../site/audio/ex058/F_s2.wav) · [Target s2 reverberant](../site/audio/ex058/rev_s2.wav) · [Interferer s1 near-anechoic](../site/audio/ex058/clean_s1.wav) · [Interferer s1 reverberant](../site/audio/ex058/rev_s1.wav)

## 006: Residual interference: Element-wise compared with FiLM

For target s2, Element-wise (E1) suppresses the interfering speaker more effectively than FiLM (F), particularly during pauses in the target speech.

s1 at +15°, s2 at +25°, separation 10°. Metric tables: [ex006.txt](ex006.txt)

- Requested **s1**: [Mixture](../site/audio/ex006/mixture.wav) · [Target s1 near-anechoic](../site/audio/ex006/clean_s1.wav) · [E1 Element-wise](../site/audio/ex006/E1_s1.wav) · [F FiLM](../site/audio/ex006/F_s1.wav) · [Target s1 reverberant](../site/audio/ex006/rev_s1.wav) · [Interferer s2 near-anechoic](../site/audio/ex006/clean_s2.wav) · [Interferer s2 reverberant](../site/audio/ex006/rev_s2.wav)
- Requested **s2**: [Mixture](../site/audio/ex006/mixture.wav) · [Target s2 near-anechoic](../site/audio/ex006/clean_s2.wav) · [E1 Element-wise](../site/audio/ex006/E1_s2.wav) · [F FiLM](../site/audio/ex006/F_s2.wav) · [Target s2 reverberant](../site/audio/ex006/rev_s2.wav) · [Interferer s1 near-anechoic](../site/audio/ex006/clean_s1.wav) · [Interferer s1 reverberant](../site/audio/ex006/rev_s1.wav)

## 003: Failure despite favorable metrics

Neither target speaker is extracted successfully by listening, although for s1 the metrics indicate target selection.

s1 at -10°, s2 at -5°, separation 5°. Metric tables: [ex003.txt](ex003.txt)

Listening review: s1 not extracted, s2 not extracted; see the table for the objective criterion.

- Requested **s1**: [Mixture](../site/audio/ex003/mixture.wav) · [Target s1 near-anechoic](../site/audio/ex003/clean_s1.wav) · [E1 Element-wise](../site/audio/ex003/E1_s1.wav) · [F FiLM](../site/audio/ex003/F_s1.wav) · [Target s1 reverberant](../site/audio/ex003/rev_s1.wav) · [Interferer s2 near-anechoic](../site/audio/ex003/clean_s2.wav) · [Interferer s2 reverberant](../site/audio/ex003/rev_s2.wav)
- Requested **s2**: [Mixture](../site/audio/ex003/mixture.wav) · [Target s2 near-anechoic](../site/audio/ex003/clean_s2.wav) · [E1 Element-wise](../site/audio/ex003/E1_s2.wav) · [F FiLM](../site/audio/ex003/F_s2.wav) · [Target s2 reverberant](../site/audio/ex003/rev_s2.wav) · [Interferer s1 near-anechoic](../site/audio/ex003/clean_s1.wav) · [Interferer s1 reverberant](../site/audio/ex003/rev_s1.wav)

