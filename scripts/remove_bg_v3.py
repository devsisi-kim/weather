#!/usr/bin/env python3
"""배경 투명화 스크립트 v3 - 이미지별 맞춤 배경색 제거"""

import os
import numpy as np
from PIL import Image
from collections import deque

CLOTHES_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "clothes")

def flood_fill_bg(img, tolerance, bg_override=None):
    """
    이미지 모서리에서 BFS로 배경색을 감지하여 투명화.
    bg_override: 배경색을 수동 지정 (RGB tuple)
    """
    img = img.convert("RGBA")
    data = np.array(img)
    h, w = data.shape[:2]
    
    # 이미 투명한 모서리면 스킵
    corner_alphas = [data[0,0,3], data[0,w-1,3], data[h-1,0,3], data[h-1,w-1,3]]
    if all(a < 10 for a in corner_alphas):
        print(f"  → 이미 투명 배경, 스킵")
        return img
    
    if bg_override is not None:
        bg_color = np.array(bg_override, dtype=np.float64)
    else:
        # 네 모서리에서 배경색 추정
        corners = []
        for y, x in [(0,0), (0,w-1), (h-1,0), (h-1,w-1)]:
            corners.append(data[y, x, :3].astype(np.float64))
        bg_color = np.mean(corners, axis=0)
    
    print(f"  배경색 추정: ({bg_color[0]:.0f}, {bg_color[1]:.0f}, {bg_color[2]:.0f})")
    
    visited = np.zeros((h, w), dtype=bool)
    to_transparent = np.zeros((h, w), dtype=bool)
    
    queue = deque()
    
    # 네 변의 모든 픽셀에서 시작
    starts = set()
    for x in range(w):
        starts.add((0, x))
        starts.add((h-1, x))
    for y in range(h):
        starts.add((y, 0))
        starts.add((y, w-1))
    
    for sy, sx in starts:
        if not visited[sy, sx]:
            pixel = data[sy, sx, :3].astype(np.float64)
            diff = np.sqrt(np.sum((pixel - bg_color) ** 2))
            if diff <= tolerance * 1.5:  # 시작점은 관대
                visited[sy, sx] = True
                queue.append((sy, sx))
                to_transparent[sy, sx] = True
    
    directions = [(-1,0), (1,0), (0,-1), (0,1)]
    while queue:
        cy, cx = queue.popleft()
        for dy, dx in directions:
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                visited[ny, nx] = True
                pixel = data[ny, nx, :3].astype(np.float64)
                diff = np.sqrt(np.sum((pixel - bg_color) ** 2))
                if diff <= tolerance:
                    to_transparent[ny, nx] = True
                    queue.append((ny, nx))
    
    transparent_count = np.sum(to_transparent)
    total = h * w
    print(f"  → 투명화 픽셀: {transparent_count}/{total} ({100*transparent_count/total:.1f}%)")
    
    # 경계 anti-aliasing
    padded = np.pad(to_transparent, 1, mode='constant', constant_values=False)
    dilated = (padded[:-2, 1:-1] | padded[2:, 1:-1] |
               padded[1:-1, :-2] | padded[1:-1, 2:] |
               to_transparent)
    border = dilated & ~to_transparent
    
    border_ys, border_xs = np.where(border)
    if len(border_ys) > 0:
        pixels = data[border_ys, border_xs, :3].astype(np.float64)
        diffs = np.sqrt(np.sum((pixels - bg_color) ** 2, axis=1))
        alpha_ratios = np.clip(diffs / (tolerance * 2.5), 0, 1)
        data[border_ys, border_xs, 3] = (255 * alpha_ratios).astype(np.uint8)
    
    data[to_transparent, 3] = 0
    return Image.fromarray(data)


# 이미지별 설정 - 분석된 실제 배경색 기반
IMAGE_CONFIG = {
    # RGBA 모드 + 밝은 회색 배경 (이전에 체커보드로 보임)
    "chilly.png":    {"tolerance": 30, "bg": (170, 170, 168)},   # 어두운 회색 배경
    "cool.png":      {"tolerance": 25, "bg": (206, 208, 205)},   # 중간 회색 배경
    "warm.png":      {"tolerance": 25, "bg": (213, 215, 212)},   # 밝은 회색 배경
    "very-cold.png": {"tolerance": 28, "bg": (194, 194, 192)},   # 중간 회색 배경
    
    # RGB 모드 + 흰색 배경
    "cold.png":      {"tolerance": 32, "bg": None},    # auto-detect (흰색~)
    "freezing.png":  {"tolerance": 25, "bg": None},    # auto-detect (흰색~)
    
    # 새로 생성된 이미지 (v1에서 이미 처리됨)
    "hot.png":       {"tolerance": 35, "bg": None},
    "mild.png":      {"tolerance": 35, "bg": None},
}


def main():
    print("=== 의류 이미지 배경 투명화 v3 ===\n")
    
    png_files = sorted([f for f in os.listdir(CLOTHES_DIR) if f.endswith('.png')])
    
    for filename in png_files:
        filepath = os.path.join(CLOTHES_DIR, filename)
        config = IMAGE_CONFIG.get(filename, {"tolerance": 25, "bg": None})
        
        print(f"처리 중: {filename} (tolerance={config['tolerance']})")
        
        try:
            img = Image.open(filepath)
            print(f"  크기: {img.size}, 모드: {img.mode}")
            
            result = flood_fill_bg(img, config["tolerance"], config.get("bg"))
            result.save(filepath, "PNG", optimize=True)
            
            new_size = os.path.getsize(filepath)
            print(f"  저장 완료: {new_size:,} bytes\n")
            
        except Exception as e:
            print(f"  오류: {e}")
            import traceback
            traceback.print_exc()
            print()
    
    print("=== 완료 ===")

if __name__ == "__main__":
    main()
