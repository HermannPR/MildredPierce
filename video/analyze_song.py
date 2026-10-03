"""Analisis de "Fractal Agreement" para sincronizar el video musical.
Uso: python analyze_song.py <audio.wav> <salida.json> [fps]
Genera: BPM, grid de beats/compases, onsets, curvas de energia por frame
(rms, graves, medios, agudos), secciones y tonalidad estimada.
"""
import sys, json
import numpy as np
import librosa

src, out = sys.argv[1], sys.argv[2]
FPS = int(sys.argv[3]) if len(sys.argv) > 3 else 24
SR = 22050
HOP = 512

y, sr = librosa.load(src, sr=SR, mono=True)
dur = len(y) / sr

# Tempo y beats
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, hop_length=HOP, trim=False)
tempo = float(np.atleast_1d(tempo)[0])
beat_t = librosa.frames_to_time(beats, sr=sr, hop_length=HOP)

# Downbeats aproximados: fase de compas 4/4 con mas energia de graves
S = np.abs(librosa.stft(y, n_fft=2048, hop_length=HOP))
freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
def band(lo, hi):
    m = (freqs >= lo) & (freqs < hi)
    return S[m].mean(axis=0)
low, mid, high = band(20, 160), band(160, 2500), band(2500, 11000)
rms = librosa.feature.rms(S=S)[0]
onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=HOP)
beat_low = low[np.clip(beats, 0, len(low) - 1)]
phase = int(np.argmax([beat_low[p::4].mean() for p in range(4)]))
downbeat_t = beat_t[phase::4]

onsets = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr, hop_length=HOP, backtrack=False)
onset_t = librosa.frames_to_time(onsets, sr=sr, hop_length=HOP)
onset_strength_at = onset_env[onsets]

# Secciones: segmentacion por similitud (chroma + mfcc), sincronizada a beats
chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=HOP)
mfcc = librosa.feature.mfcc(y=y, sr=sr, hop_length=HOP, n_mfcc=13)
feat = np.vstack([librosa.util.normalize(chroma, axis=1), librosa.util.normalize(mfcc, axis=1)])
feat_sync = librosa.util.sync(feat, beats, aggregate=np.median)
# Novedad de Foote (kernel de tablero sobre matriz de auto-similitud), sin sklearn
F = feat_sync / (np.linalg.norm(feat_sync, axis=0, keepdims=True) + 1e-9)
SSM = F.T @ F
L = 16  # beats por lado (4 compases)
g = np.outer(np.hanning(2 * L), np.hanning(2 * L))
sign = np.ones((2 * L, 2 * L)); sign[:L, L:] = -1; sign[L:, :L] = -1
K = g * sign
n = SSM.shape[0]
P = np.pad(SSM, L, mode='edge')
nov = np.array([(P[i:i + 2 * L, i:i + 2 * L] * K).sum() for i in range(n)])
nov = np.clip(nov, 0, None)
k = max(6, min(12, int(dur // 25)))
cand = [i for i in range(1, n - 1) if nov[i] >= nov[i - 1] and nov[i] >= nov[i + 1] and nov[i] > 0]
cand.sort(key=lambda i: -nov[i])
bounds = []
for i in cand:
    if all(abs(i - b) >= 16 for b in bounds):
        bounds.append(i)
    if len(bounds) >= k - 1:
        break
bounds = sorted(bounds)
bound_beats = beats[np.clip(bounds, 0, len(beats) - 1)]
bound_t = sorted(set([0.0] + [float(t) for t in librosa.frames_to_time(bound_beats, sr=sr, hop_length=HOP)] + [dur]))

# Tonalidad (Krumhansl)
maj = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
mnr = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
cm = chroma.mean(axis=1)
names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
best = max(((np.corrcoef(cm, np.roll(p, i))[0, 1], f"{names[i]} {m}") for i in range(12) for p, m in ((maj, 'mayor'), (mnr, 'menor'))))
key = best[1]

# Curvas por frame de video, normalizadas 0..1 (percentil 98)
nvf = int(np.ceil(dur * FPS))
tt = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=HOP)
vt = np.arange(nvf) / FPS
def curve(x, smooth=1):
    x = np.interp(vt, tt, x)
    if smooth > 1:
        x = np.convolve(x, np.ones(smooth) / smooth, mode='same')
    p = np.percentile(x, 98) or 1.0
    return np.clip(x / p, 0, 1)
curves = {
    'rms': curve(rms, 3), 'low': curve(low, 2), 'mid': curve(mid, 3),
    'high': curve(high, 2), 'onset': curve(onset_env, 1), 'energy_slow': curve(rms, FPS * 4),
}

sections = []
for a, b in zip(bound_t[:-1], bound_t[1:]):
    m = (vt >= a) & (vt < b)
    e = float(curves['rms'][m].mean()) if m.any() else 0
    lw = float(curves['low'][m].mean()) if m.any() else 0
    hi = float(curves['high'][m].mean()) if m.any() else 0
    sections.append({'start': round(a, 3), 'end': round(b, 3), 'energy': round(e, 3), 'low': round(lw, 3), 'high': round(hi, 3)})

res = {
    'file': src, 'duration': round(dur, 3), 'fps': FPS, 'frames': nvf,
    'tempo_bpm': round(tempo, 2), 'key': key,
    'beats': [round(float(t), 3) for t in beat_t],
    'downbeats': [round(float(t), 3) for t in downbeat_t],
    'onsets': [[round(float(t), 3), round(float(s), 3)] for t, s in zip(onset_t, onset_strength_at)],
    'sections': sections,
    'curves': {k2: [round(float(v), 3) for v in c] for k2, c in curves.items()},
}
with open(out, 'w') as f:
    json.dump(res, f)

print(f"duracion {dur:.1f}s  bpm {tempo:.1f}  tono {key}  beats {len(beat_t)}  onsets {len(onset_t)}")
for s in sections:
    bar = '#' * int(s['energy'] * 40)
    print(f"{s['start']:7.1f}-{s['end']:7.1f}  E{s['energy']:.2f} L{s['low']:.2f} H{s['high']:.2f} {bar}")
# energia cada 10 s
for i in range(0, int(dur), 10):
    m = (vt >= i) & (vt < i + 10)
    print(f"{i:4d}s rms {curves['rms'][m].mean():.2f} low {curves['low'][m].mean():.2f} high {curves['high'][m].mean():.2f} onset {curves['onset'][m].mean():.2f}")
