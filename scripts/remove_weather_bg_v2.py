#!/usr/bin/env python3
"""날씨 에셋 잔여 배경(노이즈 체커보드) 2차 투명화 스크립트"""

import os
import numpy as np
from PIL import Image
from collections import deque

WEATHER_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "weather")

def flood_fill_cleanup(img, tolerance=15):
    img = img.convert("RGBA")
    data = np.array(img)
    h, w = data.shape[:2]
    
    # 1. 1차 투명화 후 모서리 부근에 남은 불투명 픽셀들의 색상을 모두 수집
    corners = [
        data[0:32, 0:32], data[0:32, w-32:w],
        data[h-32:h, 0:32], data[h-32:h, w-32:w]
    ]
    
    noise_colors = set()
    for corner in corners:
        # 알파가 50 이상인(사실상 아직 보이는) 픽셀 추출
        ys, xs = np.where(corner[:,:,3] > 50)
        for y, x in zip(ys, xs):
            noise_colors.add(tuple(corner[y, x, :3]))
            
    if not noise_colors:
        print("  → 투명화할 모서리 노이즈 없음. 스킵.")
        return img
        
    print(f"  → 추출된 노이즈 색상 수: {len(noise_colors)}")
    
    # 노이즈가 너무 많으면(100개 이상) 옷을 건드릴 수 있으므로 상위 빈도 색상만 추출
    counts = {}
    for corner in corners:
        ys, xs = np.where(corner[:,:,3] > 50)
        for y, x in zip(ys, xs):
            c = tuple(corner[y, x, :3])
            counts[c] = counts.get(c, 0) + 1
            
    # 빈도수 기준 상위 20개 색상만 타겟팅 (옷 본체 보호)
    top_colors = [c for c, _ in sorted(counts.items(), key=lambda x: x[1], reverse=True)[:20]]
    bg_arrays = [np.array(c, dtype=np.float64) for c in top_colors]
    
    def is_bg(pixel):
        p = pixel[:3].astype(np.float64)
        return any(np.sqrt(np.sum((p - bg) ** 2)) <= tolerance for bg in bg_arrays)

    visited = np.zeros((h, w), dtype=bool)
    to_transparent = np.zeros((h, w), dtype=bool)
    
    queue = deque()
    
    # 네 변의 모든 픽셀에서 시작 (단, 기존에 이미 투명(알파 0)인 곳은 통과할 수 있도록 큐에 넣되 투명화 카운트는 안함)
    for x in range(w):
        for y in [0, h-1]:
            if not visited[y, x]:
                visited[y, x] = True
                if data[y, x, 3] == 0:
                    queue.append((y, x))
                elif is_bg(data[y, x]):
                    queue.append((y, x))
                    to_transparent[y, x] = True
                    
    for y in range(h):
        for x in [0, w-1]:
             if not visited[y, x]:
                visited[y, x] = True
                if data[y, x, 3] == 0:
                    queue.append((y, x))
                elif is_bg(data[y, x]):
                    queue.append((y, x))
                    to_transparent[y, x] = True
    
    directions = [(-1,0), (1,0), (0,-1), (0,1)]
    while queue:
        cy, cx = queue.popleft()
        for dy, dx in directions:
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                visited[ny, nx] = True
                # 투명한 길을 따라 안쪽으로 계속 파고들 수 있도록
                if data[ny, nx, 3] == 0:
                    queue.append((ny, nx))
                # 불투명한데 타겟 노이즈 색상이면 투명화 배열에 넣고 계속 전진
                elif is_bg(data[ny, nx]):
                    to_transparent[ny, nx] = True
                    queue.append((ny, nx))
    
    count = np.sum(to_transparent)
    total = h * w
    print(f"  → 2차 투명화: {count}/{total} ({100*count/total:.1f}%)")
    
    # 2차 완전 투명 적용 (안티에일리어싱 없이 확실히 날림)
    data[to_transparent, 3] = 0
    return Image.fromarray(data)

print("=== 날씨 이미지 2차 투명화 (노이즈 제거) 시작 ===")
for fname in ['cloudy.png', 'rainy.png', 'snowy.png', 'sunny.png']:
    fpath = os.path.join(WEATHER_DIR, fname)
    if os.path.exists(fpath):
        print(f"\n처리 중: {fname} (Tolerance: 15)")
        img = Image.open(fpath)
        res = flood_fill_cleanup(img, tolerance=15)
        res.save(fpath, "PNG", optimize=True)
print("\n=== 완료 ===")
