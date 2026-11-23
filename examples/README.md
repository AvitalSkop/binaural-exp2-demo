# Listening examples

Selected examples (valsep64, 160,000 training steps); not representative of average performance.
Stereo 16 kHz WAV (left, right); all signals of an example share one gain. Interactive version: https://avitalskop.github.io/binaural-exp2-demo/

Metrics: binaural (both ears jointly), against the near-anechoic image of the requested speaker; SI metrics in dB.
Development (cross-validation) split: speakers seen during training, unseen utterances and room. No held-out test results.

## 047: Successful extraction of both speakers

s1 at +15°, s2 at -30°, separation 45°. Metric tables: [ex047.txt](ex047.txt)

- Requested **s1**: [Mixture](../site/audio/ex047/mixture.wav) · [Target s1 near-anechoic](../site/audio/ex047/clean_s1.wav) · [E1 Element-wise](../site/audio/ex047/E1_s1.wav) · [F FiLM](../site/audio/ex047/F_s1.wav) · [Target s1 reverberant](../site/audio/ex047/rev_s1.wav) · [Interferer s2 near-anechoic](../site/audio/ex047/clean_s2.wav) · [Interferer s2 reverberant](../site/audio/ex047/rev_s2.wav)
- Requested **s2**: [Mixture](../site/audio/ex047/mixture.wav) · [Target s2 near-anechoic](../site/audio/ex047/clean_s2.wav) · [E1 Element-wise](../site/audio/ex047/E1_s2.wav) · [F FiLM](../site/audio/ex047/F_s2.wav) · [Target s2 reverberant](../site/audio/ex047/rev_s2.wav) · [Interferer s1 near-anechoic](../site/audio/ex047/clean_s1.wav) · [Interferer s1 reverberant](../site/audio/ex047/rev_s1.wav)

## 058: Successful extraction at 70° separation

s1 at +50°, s2 at -20°, separation 70°. Metric tables: [ex058.txt](ex058.txt)

- Requested **s1**: [Mixture](../site/audio/ex058/mixture.wav) · [Target s1 near-anechoic](../site/audio/ex058/clean_s1.wav) · [E1 Element-wise](../site/audio/ex058/E1_s1.wav) · [F FiLM](../site/audio/ex058/F_s1.wav) · [Target s1 reverberant](../site/audio/ex058/rev_s1.wav) · [Interferer s2 near-anechoic](../site/audio/ex058/clean_s2.wav) · [Interferer s2 reverberant](../site/audio/ex058/rev_s2.wav)
- Requested **s2**: [Mixture](../site/audio/ex058/mixture.wav) · [Target s2 near-anechoic](../site/audio/ex058/clean_s2.wav) · [E1 Element-wise](../site/audio/ex058/E1_s2.wav) · [F FiLM](../site/audio/ex058/F_s2.wav) · [Target s2 reverberant](../site/audio/ex058/rev_s2.wav) · [Interferer s1 near-anechoic](../site/audio/ex058/clean_s1.wav) · [Interferer s1 reverberant](../site/audio/ex058/rev_s1.wav)

## 041: Successful target switching

s1 at +10°, s2 at -35°, separation 45°. Metric tables: [ex041.txt](ex041.txt)

- Requested **s1**: [Mixture](../site/audio/ex041/mixture.wav) · [Target s1 near-anechoic](../site/audio/ex041/clean_s1.wav) · [E1 Element-wise](../site/audio/ex041/E1_s1.wav) · [F FiLM](../site/audio/ex041/F_s1.wav) · [Target s1 reverberant](../site/audio/ex041/rev_s1.wav) · [Interferer s2 near-anechoic](../site/audio/ex041/clean_s2.wav) · [Interferer s2 reverberant](../site/audio/ex041/rev_s2.wav)
- Requested **s2**: [Mixture](../site/audio/ex041/mixture.wav) · [Target s2 near-anechoic](../site/audio/ex041/clean_s2.wav) · [E1 Element-wise](../site/audio/ex041/E1_s2.wav) · [F FiLM](../site/audio/ex041/F_s2.wav) · [Target s2 reverberant](../site/audio/ex041/rev_s2.wav) · [Interferer s1 near-anechoic](../site/audio/ex041/clean_s1.wav) · [Interferer s1 reverberant](../site/audio/ex041/rev_s1.wav)

## 008: Extraction failure at 10° separation

s1 at -5°, s2 at +5°, separation 10°. Metric tables: [ex008.txt](ex008.txt)

- Requested **s1**: [Mixture](../site/audio/ex008/mixture.wav) · [Target s1 near-anechoic](../site/audio/ex008/clean_s1.wav) · [E1 Element-wise](../site/audio/ex008/E1_s1.wav) · [F FiLM](../site/audio/ex008/F_s1.wav) · [Target s1 reverberant](../site/audio/ex008/rev_s1.wav) · [Interferer s2 near-anechoic](../site/audio/ex008/clean_s2.wav) · [Interferer s2 reverberant](../site/audio/ex008/rev_s2.wav)
- Requested **s2**: [Mixture](../site/audio/ex008/mixture.wav) · [Target s2 near-anechoic](../site/audio/ex008/clean_s2.wav) · [E1 Element-wise](../site/audio/ex008/E1_s2.wav) · [F FiLM](../site/audio/ex008/F_s2.wav) · [Target s2 reverberant](../site/audio/ex008/rev_s2.wav) · [Interferer s1 near-anechoic](../site/audio/ex008/clean_s1.wav) · [Interferer s1 reverberant](../site/audio/ex008/rev_s1.wav)

## 006: Element-wise reduces interference for s2

s1 at +15°, s2 at +25°, separation 10°. Metric tables: [ex006.txt](ex006.txt)

Listening review: s1 FiLM suppresses interference better, s2 Element-wise suppresses interference better.

- Requested **s1**: [Mixture](../site/audio/ex006/mixture.wav) · [Target s1 near-anechoic](../site/audio/ex006/clean_s1.wav) · [E1 Element-wise](../site/audio/ex006/E1_s1.wav) · [F FiLM](../site/audio/ex006/F_s1.wav) · [Target s1 reverberant](../site/audio/ex006/rev_s1.wav) · [Interferer s2 near-anechoic](../site/audio/ex006/clean_s2.wav) · [Interferer s2 reverberant](../site/audio/ex006/rev_s2.wav)
- Requested **s2**: [Mixture](../site/audio/ex006/mixture.wav) · [Target s2 near-anechoic](../site/audio/ex006/clean_s2.wav) · [E1 Element-wise](../site/audio/ex006/E1_s2.wav) · [F FiLM](../site/audio/ex006/F_s2.wav) · [Target s2 reverberant](../site/audio/ex006/rev_s2.wav) · [Interferer s1 near-anechoic](../site/audio/ex006/clean_s1.wav) · [Interferer s1 reverberant](../site/audio/ex006/rev_s1.wav)

