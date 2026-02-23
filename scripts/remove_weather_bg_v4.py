#!/usr/bin/env python3
"""새 3D 날씨 에셋 투명화 스크립트 (흰색 배경 제거)"""

import os
import numpy as np
from PIL import Image
from collections import deque

WEATHER_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "weather")

def flood_fill_white_bg(img, tolerance=30):
    img = img.convert("RGBA")
    data = np.array(img)
    h, w = data.shape[:2]
    
    # 순백색, 매우 밝은 회색 계열을 배경색 후보로 지정
    bg_colors = [(255,255,255), (250,250,250), (245,245,245), (240,240,240)]
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
    print(f"  → 투명화: {count}/{total} ({100*count/total:.1f}%)")
    
    padded = np.pad(to_transparent, 1, mode='constant', constant_values=False)
    dilated = (padded[:-2, 1:-1] | padded[2:, 1:-1] |
               padded[1:-1, :-2] | padded[1:-1, 2:] |
               to_transparent)
    border = dilated & ~to_transparent
    
    border_ys, border_xs = np.where(border)
    if len(border_ys) > 0:
        for i in range(len(border_ys)):
            y, x = border_ys[i], border_xs[i]
            d = min_bg_diff(data[y, x])
            alpha = min(int(255 * d / (tolerance * 1.5)), 255)
            data[y, x, 3] = alpha
    
    data[to_transparent, 3] = 0
    return Image.fromarray(data)

# 각 이미지에 대한 tolerance (구름이 흰색을 띄므로 tolerance를 타이트하게 가져감)
IMAGE_CONFIG = {
    "sunny.png": 50,    # 노란색이라 흰색 구분 쉬움
    "rainy.png": 35,    # 파스텔 회청색 구름
    "snowy.png": 30,    # 눈송이가 있어 tolerance를 너무 높이면 같이 지워질 수 있음
    "cloudy.png": 25    # 흰 구름이 포함되어 있으므로 가장 낮게
}

print("=== 재생성 날씨 이미지 투명화 시작 ===")
for fname in ['cloudy.png', 'rainy.png', 'snowy.png', 'sunny.png']:
    fpath = os.path.join(WEATHER_DIR, fname)
    if os.path.exists(fpath):
        print(f"\n처리 중: {fname} (Tolerance: {IMAGE_CONFIG[fname]})")
        img = Image.open(fpath)
        res = flood_fill_white_bg(img, tolerance=IMAGE_CONFIG[fname])
        res.save(fpath, "PNG", optimize=True)
print("\n=== 완료 ===")
