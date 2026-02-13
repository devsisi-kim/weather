# Weather Outfit Recommender

MVP를 넘어 백엔드 API를 포함한 실제 앱 구조로 구성한 날씨 기반 옷차림 추천 앱입니다.

## 구성
- Frontend: `index.html`, `styles.css`, `app.js`
- Backend: `server.js`, `src/server/app-server.js`
- Domain logic: `src/recommendation.js`
- Persistent data: `data/locations.json` (최대 2개 위치 저장)

## 핵심 기능
- 위치 1~2개 저장/삭제 (서버 저장)
- 현재 날씨 조회 (기온/습도/UV/강수)
- 옷 추천(대표 이미지 + 텍스트)
- 소품 추천(모자/선크림/우산/목도리/장갑)
- API 헬스체크: `/api/health`
- 대기질(미세먼지 PM2.5/PM10) 표시 및 마스크 추천
- 일교차 표시 및 10도 이상일 때 머플러 추천
- 데이터 갱신 시각 노출

## 데이터 출처(무료)
- 위치 검색 및 날씨: Open-Meteo (`https://geocoding-api.open-meteo.com`, `https://api.open-meteo.com/v1/forecast`)
- 대기질 보강: Open-Meteo Air Quality API (`https://air-quality-api.open-meteo.com`) + 실패 시 WAQI fallback (`https://api.waqi.info`)

### WAQI 토큰 설정(실서비스 권장)
- 기본 동작은 `demo` 토큰을 사용하지만, 실제 호출량이 늘면 환경변수 `WAQI_TOKEN`을 등록하세요.
```bash
export WAQI_TOKEN=your_token
npm start
```

## 실행
```bash
cd "/Users/sia/Documents/New project"
npm start
```
브라우저: `http://localhost:8080`

## 테스트
```bash
cd "/Users/sia/Documents/New project"
npm test
```

## 직접 실행 체크리스트
1. 저장된 위치 1~2개 추가
2. 새로고침 버튼으로 `/api/recommendations` 갱신
3. 카드에서 다음 항목 확인
   - 기온, 습도, UV
   - 일교차
   - 대기질(PM2.5/PM10/US-AQI)
   - 갱신 시각
