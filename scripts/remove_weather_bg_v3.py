#!/usr/bin/env python3
"""날씨 에셋 잔여 배경(노이즈 체커보드) 3차 최종 투명화 스크립트"""

import os
import numpy as np
from PIL import Image

WEATHER_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "weather")

# sunny, rainy 등에서 발견된 주요 체커보드 노이즈 색상
noise_colors = [
    np.array([45,47,44]), np.array([46,46,44]),
    np.array([53,55,54]), np.array([53,55,52]),
    np.array([71,73,70]), np.array([80,82,81]),
    np.array([77,79,76]), np.array([86,88,85]),
    np.array([92,94,91]), np.array([121,123,120]),
    np.array([124,126,125]), np.array([111,113,110]),
    np.array([112,112,112])
]

def remove_gray_noise(img_name):
    fpath = os.path.join(WEATHER_DIR, img_name)
    if not os.path.exists(fpath): return

    img = Image.open(fpath).convert("RGBA")
    data = np.array(img)
    h, w = data.shape[:2]
    
    transparent_count = 0
    for y in range(h):
        for x in range(w):
            if data[y, x, 3] > 0:
                p = data[y, x, :3].astype(np.float64)
                
                is_match = False
                # 1. 특정 노이즈 색상과 가까운 경우
                for bg in noise_colors:
                    if np.sqrt(np.sum((p - bg) ** 2)) < 20: 
                        is_match = True
                        break
                
                # 2. 날씨 아이콘(구름, 해 등)의 본체 색상이 아닌 완전한 회색조(RGB 편차가 거의 없음)면서
                # 밝기가 일정 범위에 있는 경우 타겟팅 (체커보드 잔재)
                if not is_match:
                    std = np.std(p)
                    # 구름이나 눈썹 등에도 회색이 쓰일 수 있으므로 
                    # sunny(노랑), rainy(구름 밑부분은 조금 짙은 파랑/회색이 섞일 수 있음) 특성 고려
                    # RGB 편차가 7 미만이면서 밝기가 150 미만인 어두운 순수 회색만 타겟팅
                    if std < 7 and np.mean(p) < 150:
                        is_match = True
                        
                if is_match:
                    # rainy의 빗방울(하늘색) 보호를 위해 B값이 유독 높은 픽셀은 제외
                    if p[2] > p[0] + 15 and p[2] > p[1] + 15:
                        continue
                        
                    data[y, x, 3] = 0
                    transparent_count += 1
                    
    print(f"  → {img_name} 투명화 픽셀: {transparent_count}")
    Image.fromarray(data).save(fpath, "PNG", optimize=True)

print("=== 날씨 이미지 최종 노이즈 제거 시작 ===")
for fname in ['cloudy.png', 'rainy.png', 'snowy.png', 'sunny.png']:
    print(f"처리 중: {fname}")
    remove_gray_noise(fname)
print("=== 완료 ===")
