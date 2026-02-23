#!/usr/bin/env python3
"""배경 투명화 v4 - 체커보드 패턴(두 색상) + 흰색 배경 처리"""

import os
import numpy as np
from PIL import Image
from collections import deque

CLOTHES_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "clothes")


def flood_fill_multiple_bg(img, bg_colors, tolerance):
    """
    여러 배경색에 대해 BFS flood fill 투명화.
    bg_colors: list of (R,G,B) tuples
    """
    img = img.convert("RGBA")
    data = np.array(img)
    h, w = data.shape[:2]
    
    # 이미 투명한 모서리면 스킵
    corners = [(0,0), (0,w-1), (h-1,0), (h-1,w-1)]
    if all(data[y,x,3] < 10 for y,x in corners):
        print(f"  → 이미 완전 투명 배경, 스킵")
        return img
    
    bg_arrays = [np.array(c, dtype=np.float64) for c in bg_colors]
    
    def is_bg(pixel):
        """여러 배경색 중 하나와 매칭되는지 확인"""
        p = pixel[:3].astype(np.float64)
        return any(np.sqrt(np.sum((p - bg) ** 2)) <= tolerance for bg in bg_arrays)
    
    def is_bg_start(pixel):
        """시작점은 관대하게"""
        p = pixel[:3].astype(np.float64)
        return any(np.sqrt(np.sum((p - bg) ** 2)) <= tolerance * 1.5 for bg in bg_arrays)
    
    def min_bg_diff(pixel):
        """모든 배경색과의 최소 거리 반환"""
        p = pixel[:3].astype(np.float64)
        return min(np.sqrt(np.sum((p - bg) ** 2)) for bg in bg_arrays)

    visited = np.zeros((h, w), dtype=bool)
    to_transparent = np.zeros((h, w), dtype=bool)
    
    queue = deque()
    
    # 네 변의 모든 픽셀에서 시작
    for x in range(w):
        for y in [0, h-1]:
            if not visited[y, x] and is_bg_start(data[y, x]):
                visited[y, x] = True
                queue.append((y, x))
                to_transparent[y, x] = True
    for y in range(h):
        for x in [0, w-1]:
            if not visited[y, x] and is_bg_start(data[y, x]):
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
    
    # 경계 anti-aliasing
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
            alpha = min(int(255 * d / (tolerance * 2.5)), 255)
            data[y, x, 3] = alpha
    
    data[to_transparent, 3] = 0
    return Image.fromarray(data)


# 이미지별 상세 설정
# 체커보드 이미지: 8x8 블록 교대의 두 색상
# 흰색 배경 이미지: 단일 배경색
IMAGE_CONFIG = {
    "warm.png": {
        "bg_colors": [(255,255,255), (250,250,250), (245,245,245), (240,240,240)],
        "tolerance": 50
    },
    "cool.png": {
        "bg_colors": [(255,255,255), (250,250,250), (245,245,245), (240,240,240)],
        "tolerance": 35
    },
    "chilly.png": {
        "bg_colors": [(255,255,255), (250,250,250), (245,245,245), (240,240,240)],
        "tolerance": 30
    },
    "very-cold.png": {
        "bg_colors": [(255,255,255), (250,250,250), (245,245,245), (240,240,240)],
        "tolerance": 40
    },
    "cold.png": {
        "bg_colors": [(248,250,247), (255,255,255), (245,245,243)],
        "tolerance": 30
    },
    "freezing.png": {
        "bg_colors": [(238,240,241), (255,255,255), (245,245,243)],
        "tolerance": 22
    },
    "hot.png": {
        "bg_colors": [(255,255,255), (250,250,250), (245,245,245), (240,240,240)],
        "tolerance": 60
    },
    "mild.png": {
        "bg_colors": [(255,255,255), (250,250,250), (245,245,245), (240,240,240)],
        "tolerance": 60
    },
}


def main():
    print("=== 의류 이미지 배경 투명화 v4 ===\n")
    
    png_files = sorted([f for f in os.listdir(CLOTHES_DIR) if f.endswith('.png')])
    
    for filename in png_files:
        filepath = os.path.join(CLOTHES_DIR, filename)
        config = IMAGE_CONFIG.get(filename, {
            "bg_colors": [(255,255,255)],
            "tolerance": 25
        })
        
        print(f"처리 중: {filename}")
        print(f"  배경색: {config['bg_colors']}")
        print(f"  Tolerance: {config['tolerance']}")
        
        try:
            img = Image.open(filepath)
            print(f"  크기: {img.size}, 모드: {img.mode}")
            
            result = flood_fill_multiple_bg(
                img, config["bg_colors"], config["tolerance"]
            )
            result.save(filepath, "PNG", optimize=True)
            
            new_size = os.path.getsize(filepath)
            print(f"  저장: {new_size:,} bytes\n")
            
        except Exception as e:
            print(f"  오류: {e}")
            import traceback
            traceback.print_exc()
            print()
    
    print("=== 완료 ===")

if __name__ == "__main__":
    main()
