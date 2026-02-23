#!/usr/bin/env python3
"""배경 투명화 스크립트 v2 - 체커보드 패턴 + 흰색 배경 처리"""

import os
import numpy as np
from PIL import Image
from collections import deque

CLOTHES_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "clothes")

def is_checkerboard_pixel(data, y, x, block_size=8):
    """
    주어진 픽셀이 체커보드 패턴의 일부인지 판단.
    체커보드: (y//block, x//block)이 짝수+짝수 또는 홀+홀이면 밝은 회색(~204),
    그 외이면 흰색(~255)
    """
    r, g, b = int(data[y, x, 0]), int(data[y, x, 1]), int(data[y, x, 2])
    
    # 체커보드의 두 색상: 흰색(~255,255,255)과 밝은 회색(~204,204,204)
    is_white = (abs(r - 255) < 15 and abs(g - 255) < 15 and abs(b - 255) < 15)
    is_gray = (abs(r - 204) < 20 and abs(g - 204) < 20 and abs(b - 204) < 20)
    
    if not (is_white or is_gray):
        return False
    
    # 블록 위치로 예상되는 색상 확인
    block_y = (y // block_size) % 2
    block_x = (x // block_size) % 2
    
    if (block_y + block_x) % 2 == 0:
        return is_white  # 짝수 블록은 흰색이어야 함
    else:
        return is_gray   # 홀수 블록은 회색이어야 함


def detect_and_remove_checkerboard(img, block_size=8):
    """
    RGB 체커보드 패턴을 감지하고 실제 투명으로 변환.
    체커보드 패턴: 8x8 블록의 흰(#fff)/회색(#ccc) 교차.
    """
    img = img.convert("RGBA")
    data = np.array(img)
    h, w = data.shape[:2]
    
    # 먼저 체커보드 패턴이 존재하는지 확인 (모서리 영역 검사)
    corner_checks = 0
    corner_total = 0
    for y in range(0, min(32, h)):
        for x in range(0, min(32, w)):
            corner_total += 1
            if is_checkerboard_pixel(data, y, x, block_size):
                corner_checks += 1
    
    checkerboard_ratio = corner_checks / corner_total if corner_total > 0 else 0
    
    if checkerboard_ratio < 0.3:
        print(f"  체커보드 패턴 미감지 (모서리 매칭: {checkerboard_ratio:.1%})")
        return None
    
    print(f"  체커보드 패턴 감지됨 (모서리 매칭: {checkerboard_ratio:.1%})")
    
    # BFS로 연결된 체커보드 영역을 투명화
    visited = np.zeros((h, w), dtype=bool)
    to_transparent = np.zeros((h, w), dtype=bool)
    
    # 모서리에서 BFS 시작
    queue = deque()
    starts = []
    for x in range(0, w, 2):
        starts.extend([(0, x), (h-1, x)])
    for y in range(0, h, 2):
        starts.extend([(y, 0), (y, w-1)])
    
    for sy, sx in starts:
        if not visited[sy, sx] and is_checkerboard_pixel(data, sy, sx, block_size):
            visited[sy, sx] = True
            queue.append((sy, sx))
            to_transparent[sy, sx] = True
    
    directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    while queue:
        cy, cx = queue.popleft()
        for dy, dx in directions:
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                visited[ny, nx] = True
                if is_checkerboard_pixel(data, ny, nx, block_size):
                    to_transparent[ny, nx] = True
                    queue.append((ny, nx))
    
    transparent_count = np.sum(to_transparent)
    print(f"  → 체커보드 투명화: {transparent_count}/{h*w} ({100*transparent_count/(h*w):.1f}%)")
    
    # 경계 anti-aliasing
    padded = np.pad(to_transparent, 1, mode='constant', constant_values=False)
    dilated = (padded[:-2, 1:-1] | padded[2:, 1:-1] |
               padded[1:-1, :-2] | padded[1:-1, 2:] |
               to_transparent)
    border = dilated & ~to_transparent
    
    border_ys, border_xs = np.where(border)
    if len(border_ys) > 0:
        # 경계 픽셀을 체커보드 색상과의 거리로 alpha 조정
        pixels = data[border_ys, border_xs, :3].astype(np.float64)
        # 흰색과 회색 사이 평균 (약 230, 230, 230)
        bg = np.array([230.0, 230.0, 230.0])
        diffs = np.sqrt(np.sum((pixels - bg) ** 2, axis=1))
        alpha_ratios = np.clip(diffs / 60.0, 0, 1)
        data[border_ys, border_xs, 3] = (255 * alpha_ratios).astype(np.uint8)
    
    data[to_transparent, 3] = 0
    return Image.fromarray(data)


def flood_fill_white_bg(img, tolerance):
    """흰색 배경을 BFS로 투명화"""
    img = img.convert("RGBA")
    data = np.array(img)
    h, w = data.shape[:2]
    
    # 배경색 추정 (네 모서리)
    corners = [
        data[0, 0, :3].astype(np.float64),
        data[0, w-1, :3].astype(np.float64),
        data[h-1, 0, :3].astype(np.float64),
        data[h-1, w-1, :3].astype(np.float64),
    ]
    bg_color = np.mean(corners, axis=0)
    
    # 모서리 alpha가 이미 0이면 이미 투명
    corner_alphas = [data[0,0,3], data[0,w-1,3], data[h-1,0,3], data[h-1,w-1,3]]
    if all(a < 10 for a in corner_alphas):
        print(f"  → 이미 투명 배경")
        return img
    
    visited = np.zeros((h, w), dtype=bool)
    to_transparent = np.zeros((h, w), dtype=bool)
    
    queue = deque()
    starts = []
    for x in range(0, w, 3):
        starts.extend([(0, x), (h-1, x)])
    for y in range(0, h, 3):
        starts.extend([(y, 0), (y, w-1)])
    
    for sy, sx in starts:
        if not visited[sy, sx]:
            pixel = data[sy, sx, :3].astype(np.float64)
            diff = np.sqrt(np.sum((pixel - bg_color) ** 2))
            if diff <= tolerance * 1.5:
                visited[sy, sx] = True
                queue.append((sy, sx))
                to_transparent[sy, sx] = True
    
    directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
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
    print(f"  → 투명화 픽셀: {transparent_count}/{h*w} ({100*transparent_count/(h*w):.1f}%)")
    
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
        alpha_ratios = np.clip(diffs / (tolerance * 2), 0, 1)
        data[border_ys, border_xs, 3] = (255 * alpha_ratios).astype(np.uint8)
    
    data[to_transparent, 3] = 0
    return Image.fromarray(data)


# 이미지별 처리 설정
IMAGE_CONFIG = {
    # 체커보드 패턴이 있는 이미지들 (RGB 체커보드 → 실제 투명)
    "chilly.png":    {"type": "checkerboard"},
    "cool.png":      {"type": "checkerboard"},
    "warm.png":      {"type": "checkerboard"},
    "very-cold.png": {"type": "checkerboard"},
    
    # 흰색 배경 이미지들
    "cold.png":      {"type": "white_bg", "tolerance": 28},
    "freezing.png":  {"type": "white_bg", "tolerance": 22},
    
    # 새로 생성된 이미지 (이미 1차 처리 완료, 잔여물 정리)
    "hot.png":       {"type": "white_bg", "tolerance": 35},
    "mild.png":      {"type": "white_bg", "tolerance": 35},
}


def main():
    print("=== 의류 이미지 배경 투명화 v2 ===\n")
    
    png_files = sorted([f for f in os.listdir(CLOTHES_DIR) if f.endswith('.png')])
    
    for filename in png_files:
        filepath = os.path.join(CLOTHES_DIR, filename)
        config = IMAGE_CONFIG.get(filename, {"type": "white_bg", "tolerance": 25})
        
        print(f"처리 중: {filename} (방식: {config['type']})")
        
        try:
            img = Image.open(filepath)
            print(f"  크기: {img.size}, 모드: {img.mode}")
            
            if config["type"] == "checkerboard":
                result = detect_and_remove_checkerboard(img)
                if result is None:
                    # 체커보드가 감지되지 않으면 흰 배경 시도
                    print(f"  → 흰색 배경 방식으로 전환")
                    result = flood_fill_white_bg(img, config.get("tolerance", 25))
            else:
                result = flood_fill_white_bg(img, config["tolerance"])
            
            result.save(filepath, "PNG")
            new_size = os.path.getsize(filepath)
            print(f"  저장 완료: {new_size:,} bytes\n")
            
        except Exception as e:
            print(f"  오류: {e}\n")
            import traceback
            traceback.print_exc()
    
    print("=== 완료 ===")

if __name__ == "__main__":
    main()
