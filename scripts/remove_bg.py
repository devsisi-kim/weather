#!/usr/bin/env python3
"""배경 투명화 스크립트 - clothes 디렉토리의 PNG 이미지 배경 제거"""

import os
import sys
from PIL import Image
import numpy as np
from collections import deque

CLOTHES_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "clothes")

# 이미지별 tolerance 설정
# 밝은 배경 + 밝은 옷 → 낮은 tolerance
# 어두운/뚜렷한 배경-옷 구분 → 높은 tolerance
TOLERANCE_MAP = {
    "freezing.png": 18,   # 3D 스타일, 밝은 배경과 밝은 옷 색상이 가까움
    "cold.png": 22,       # 비니+코트+장갑, 밝은 배경
    "very-cold.png": 22,  # 더플코트+머플러, 밝은 배경
    "chilly.png": 25,     # 양털자켓+조거팬츠, 체커보드 배경 이미 투명
    "cool.png": 25,       # 맨투맨+청바지, 체커보드 배경 이미 투명
    "warm.png": 25,       # 반팔+면바지, 체커보드 배경 이미 투명
    "hot.png": 30,        # 새로 생성된 이미지, 흰 배경
    "mild.png": 30,       # 새로 생성된 이미지, 흰 배경
}

def get_background_color(img_array):
    """이미지 네 모서리에서 배경색 추정"""
    h, w = img_array.shape[:2]
    corners = [
        img_array[0, 0],
        img_array[0, w-1],
        img_array[h-1, 0],
        img_array[h-1, w-1],
    ]
    # 네 모서리 평균으로 배경색 추정
    bg_color = np.mean(corners, axis=0).astype(np.uint8)
    return bg_color

def flood_fill_transparent(img, tolerance):
    """
    네 모서리에서 시작하여 배경색과 유사한 픽셀을 투명하게 만듦.
    BFS 방식으로 연결된 픽셀만 처리하여 옷 내부 색상은 보존.
    """
    # RGBA로 변환
    img = img.convert("RGBA")
    data = np.array(img)
    h, w = data.shape[:2]
    
    # 배경색 추정
    bg_color = get_background_color(data)
    
    # 이미 투명한 배경(체커보드)이 있는 경우 - alpha 채널 확인
    # 모서리 알파가 이미 0이면 이미 투명한 배경
    corner_alphas = [
        data[0, 0, 3], data[0, w-1, 3],
        data[h-1, 0, 3], data[h-1, w-1, 3]
    ]
    if all(a < 10 for a in corner_alphas):
        print(f"  → 이미 투명 배경, 반투명 잔여물만 정리")
        # 반투명 잔여물 정리: 거의 투명한 픽셀(alpha < threshold) 완전 투명화
        mask = data[:, :, 3] < 30
        data[mask, 3] = 0
        return Image.fromarray(data)
    
    # BFS로 배경 영역 찾기
    visited = np.zeros((h, w), dtype=bool)
    to_make_transparent = np.zeros((h, w), dtype=bool)
    
    # 네 모서리 + 모서리 근처 에지에서 시작
    start_points = []
    # 상하좌우 변을 따라 시작점 추가
    for x in range(0, w, 4):
        start_points.append((0, x))      # 상단
        start_points.append((h-1, x))    # 하단
    for y in range(0, h, 4):
        start_points.append((y, 0))      # 좌측
        start_points.append((y, w-1))    # 우측
    
    queue = deque()
    for sy, sx in start_points:
        if not visited[sy, sx]:
            # 시작점의 색상이 배경색과 유사한지 확인
            pixel = data[sy, sx, :3].astype(np.int16)
            bg = bg_color[:3].astype(np.int16)
            diff = np.sqrt(np.sum((pixel - bg) ** 2))
            if diff <= tolerance * 1.5:  # 시작점은 약간 더 관대하게
                visited[sy, sx] = True
                queue.append((sy, sx))
                to_make_transparent[sy, sx] = True
    
    # BFS 진행
    directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    while queue:
        cy, cx = queue.popleft()
        for dy, dx in directions:
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                visited[ny, nx] = True
                pixel = data[ny, nx, :3].astype(np.int16)
                bg = bg_color[:3].astype(np.int16)
                diff = np.sqrt(np.sum((pixel - bg) ** 2))
                if diff <= tolerance:
                    to_make_transparent[ny, nx] = True
                    queue.append((ny, nx))
    
    # 투명화 적용
    transparent_count = np.sum(to_make_transparent)
    total_count = h * w
    print(f"  → 투명화 픽셀: {transparent_count}/{total_count} ({100*transparent_count/total_count:.1f}%)")
    
    # 경계 부분 부드럽게 처리 (anti-aliasing) - 순수 numpy로 구현
    # 1px dilation으로 경계 마스크 생성
    padded = np.pad(to_make_transparent, 1, mode='constant', constant_values=False)
    dilated = (padded[:-2, 1:-1] | padded[2:, 1:-1] |
               padded[1:-1, :-2] | padded[1:-1, 2:] |
               to_make_transparent)
    border = dilated & ~to_make_transparent
    
    # 경계 픽셀의 alpha를 배경색과의 거리에 비례하여 조정
    border_ys, border_xs = np.where(border)
    if len(border_ys) > 0:
        pixels = data[border_ys, border_xs, :3].astype(np.int16)
        bg = bg_color[:3].astype(np.int16)
        diffs = np.sqrt(np.sum((pixels - bg) ** 2, axis=1))
        alpha_ratios = np.clip(diffs / (tolerance * 2), 0, 1)
        data[border_ys, border_xs, 3] = (255 * alpha_ratios).astype(np.uint8)
    
    # 배경 영역 투명화
    data[to_make_transparent, 3] = 0
    
    return Image.fromarray(data)

def main():
    print("=== 의류 이미지 배경 투명화 시작 ===\n")
    
    png_files = sorted([f for f in os.listdir(CLOTHES_DIR) if f.endswith('.png')])
    
    for filename in png_files:
        filepath = os.path.join(CLOTHES_DIR, filename)
        tolerance = TOLERANCE_MAP.get(filename, 25)
        
        print(f"처리 중: {filename} (tolerance={tolerance})")
        
        try:
            img = Image.open(filepath)
            print(f"  크기: {img.size}, 모드: {img.mode}")
            
            result = flood_fill_transparent(img, tolerance)
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
