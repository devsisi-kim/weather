#!/usr/bin/env python3
"""날씨 에셋 배경 투명화 스크립트"""

import os
import numpy as np
from PIL import Image
from collections import deque

WEATHER_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "weather")

def get_gradient_corners(data, w, h):
    tl = data[0:8, 0:8, :3].mean(axis=(0,1))
    tr = data[0:8, w-8:w, :3].mean(axis=(0,1))
    bl = data[h-8:h, 0:8, :3].mean(axis=(0,1))
    br = data[h-8:h, w-8:w, :3].mean(axis=(0,1))
    return [tuple(map(int, c)) for c in [tl, tr, bl, br]]

def flood_fill_multiple_bg(img, tolerance=30):
    img = img.convert("RGBA")
    data = np.array(img)
    h, w = data.shape[:2]
    
    # 자동 배경색 추출
    bg_colors = get_gradient_corners(data, w, h)
    bg_arrays = [np.array(c, dtype=np.float64) for c in bg_colors]
    
    def is_bg(pixel):
        p = pixel[:3].astype(np.float64)
        return any(np.sqrt(np.sum((p - bg) ** 2)) <= tolerance for bg in bg_arrays)
    
    def min_bg_diff(pixel):
        p = pixel[:3].astype(np.float64)
        return min(np.sqrt(np.sum((p - bg) ** 2)) for bg in bg_arrays)

    visited = np.zeros((h, w), dtype=bool)
    to_transparent = np.zeros((h, w), dtype=bool)
    
    queue = deque()
    
    # 네 변의 모든 픽셀에서 시작
    for x in range(w):
        for y in [0, h-1]:
            if not visited[y, x] and is_bg(data[y, x]):
                visited[y, x] = True
                queue.append((y, x))
                to_transparent[y, x] = True
    for y in range(h):
        for x in [0, w-1]:
            if not visited[y, x] and is_bg(data[y, x]):
                visited[y, x] = True
                queue.append((y, x))
                to_transparent[y, x] = True
    
    directions = [(-1,0), (1,0), (0,-1), (0,1)]
    while queue:
        cy, cx = queue.popleft()
        for dy, dx in directions:
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                visited[ny, nx] = True
                if is_bg(data[ny, nx]):
                    to_transparent[ny, nx] = True
                    queue.append((ny, nx))
    
    count = np.sum(to_transparent)
    total = h * w
    print(f"  → 추출 배경색: {bg_colors}")
    print(f"  → 투명화: {count}/{total} ({100*count/total:.1f}%)")
    
    # 경계 anti-aliasing
    padded = np.pad(to_transparent, 1, mode='constant', constant_values=False)
    border = (padded[:-2, 1:-1] | padded[2:, 1:-1] |
               padded[1:-1, :-2] | padded[1:-1, 2:] |
               to_transparent) & ~to_transparent
    
    ys, xs = np.where(border)
    for y, x in zip(ys, xs):
        d = min_bg_diff(data[y, x])
        alpha = min(int(255 * d / (tolerance * 1.5)), 255)
        data[y, x, 3] = alpha
    
    data[to_transparent, 3] = 0
    return Image.fromarray(data)

IMAGE_CONFIG = {
    "cloudy.png": 30,
    "rainy.png": 45,
    "snowy.png": 40,
    "sunny.png": 45
}

print("=== 날씨 이미지 투명화 시작 ===")
for fname in ['cloudy.png', 'rainy.png', 'snowy.png', 'sunny.png']:
    fpath = os.path.join(WEATHER_DIR, fname)
    if os.path.exists(fpath):
        print(f"\n처리 중: {fname} (Tolerance: {IMAGE_CONFIG[fname]})")
        img = Image.open(fpath)
        res = flood_fill_multiple_bg(img, tolerance=IMAGE_CONFIG[fname])
        res.save(fpath, "PNG", optimize=True)
print("\n=== 완료 ===")
