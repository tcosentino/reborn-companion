# Finds where each guide screenshot sits on the game's maps, for scripts/apply-hidden-maps.ts --suggest.
# Reads <dir>/candidates.json ([{file, shot, maps: [id]}]) and full map renders <dir>/full/<id>.png (32 px tiles);
# writes <dir>/located.json ({file: {map, box: [x, y, w, h] in tiles, scale, score}}).
# Method: both images shrunk to 4 px per tile, the screenshot tried at every scale from 28 to 80 px per tile, and
# the best offset found by FFT sum of squared differences. Needs numpy and Pillow.
# Usage: python3 scripts/locate-shots.py <dir>
import json, sys
import numpy as np
from PIL import Image

PX = 4


def gray(img):
    return np.asarray(img.convert('L'), dtype=np.float32) / 255


def ssd(M, T):
    H, W = M.shape
    h, w = T.shape
    if h > H or w > W:
        return None
    F = lambda a: np.fft.rfft2(a, s=(H, W))
    corr = np.fft.irfft2(F(M) * np.conj(F(T)), s=(H, W))[:H - h + 1, :W - w + 1]
    ii = np.pad(np.cumsum(np.cumsum(M * M, 0), 1), ((1, 0), (1, 0)))
    win = ii[h:, w:] - ii[:-h, w:] - ii[h:, :-w] + ii[:-h, :-w]
    return (win[:H - h + 1, :W - w + 1] - 2 * corr + (T * T).sum()) / (h * w)


def locate(M, shot):
    best = None
    for s in np.arange(28, 80, 0.5):
        w, h = round(shot.width * PX / s), round(shot.height * PX / s)
        if w < 8 or h < 8:
            continue
        d = ssd(M, gray(shot.resize((w, h), Image.BOX)))
        if d is None:
            continue
        y, x = np.unravel_index(np.argmin(d), d.shape)
        if best is None or d[y, x] < best['score']:
            best = {'score': float(d[y, x]), 'scale': float(s), 'box': [x / PX, y / PX, w / PX, h / PX]}
    return best


def main(d):
    cands = json.load(open(f'{d}/candidates.json'))
    maps = {}
    out = {}
    for c in cands:
        found = None
        for m in c['maps']:
            if m not in maps:
                full = Image.open(f'{d}/full/{m}.png')
                maps[m] = gray(full.resize((full.width * PX // 32, full.height * PX // 32), Image.BOX))
            r = locate(maps[m], Image.open(c['shot']))
            if r and (found is None or r['score'] < found['score']):
                found = {'map': m, **r}
        if found:
            out[c['file']] = found
            print(f"{c['file']}: map {found['map']} at {found['box']} (scale {found['scale']}, score {found['score']:.4f})")
    json.dump(out, open(f'{d}/located.json', 'w'), indent=1)


if __name__ == '__main__':
    main(sys.argv[1])
