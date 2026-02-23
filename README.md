# Weather Outfit Recommender

날씨 데이터를 기반으로 옷차림/소품을 추천하는 Node.js 웹앱입니다.
현재 버전은 UI 고도화(세련된 카드 레이아웃, 구간별 아이콘), 데이터 안정성(실시간 API 실패 시 폴백), 서버 기동 안정성(포트 충돌 자동 재시도)을 포함합니다.

## 최신 제품 형상 (Current Product Shape)
- 위치 1~2개를 저장하고 각 위치별 추천 카드를 동시에 보여줍니다.
- 추천 카드에는 기온/습도/UV 구간 라벨 + 아이콘, 강수확률, 일교차, 대기질, 갱신 시각이 표시됩니다.
- 의상 일러스트는 `assets/clothes/*.png`/`assets/clothes/*.svg` 자산을 사용합니다.
- 데이터 소스 상태를 카드에 노출합니다.
  - `실시간 API`
  - `임시 데이터 (외부 API 오류 메시지)`
- 외부 날씨 API 실패 시에도 앱이 500으로 중단되지 않고 기본 날씨값으로 추천을 유지합니다.

## 구성
- Frontend: `index.html`, `styles.css`, `app.js`
- Backend: `server.js`, `src/server/app-server.js`
- Domain Logic(도메인 로직): `src/recommendation.js`
- Data Store(저장소): `data/locations.json` (최대 2개 위치 저장)
- Static Assets(정적 자산):
  - 의상: `assets/clothes/*`
  - 지표 아이콘: `assets/weather/*`

## 핵심 동작
1. `GET /api/locations`로 저장된 위치를 로드합니다.
2. `POST /api/locations`로 위치를 추가합니다(최대 2개).
3. `GET /api/recommendations`에서 각 위치별로 다음을 생성합니다.
   - 실시간 날씨(Open-Meteo)
   - 대기질(Open-Meteo Air Quality, 실패 시 WAQI 보강)
   - 추천 의상/소품/노트(`recommendOutfit`)
4. 날씨 API 실패 시 서버는 폴백 날씨값으로 응답을 계속 제공합니다.

## API 요약
- `GET /api/health`: 서버 헬스체크
- `GET /api/locations`: 위치 목록 조회
- `POST /api/locations`: 위치 추가 (`{ "query": "Seoul" }`)
- `DELETE /api/locations/:id`: 위치 삭제
- `GET /api/recommendations`: 추천 카드 조회

## 환경 변수
- `PORT`: 서버 시작 포트 (기본값 `8080`)
- `HOST`: 바인딩 주소 (기본값 `127.0.0.1`)
- `WAQI_TOKEN`: WAQI 토큰 (미설정 시 `demo`)

예시:
```bash
HOST=127.0.0.1 PORT=8080 WAQI_TOKEN=your_token npm start
```

## 실행
```bash
cd "/Users/sia/Documents/New project"
npm start
```

서버 시작 로그 예시:
```text
Weather Outfit server listening on http://127.0.0.1:8080
```

포트가 이미 점유된 경우:
```text
Port 8080 is in use. Retrying on 8081...
Weather Outfit server listening on http://127.0.0.1:8081
```

## 테스트
```bash
cd "/Users/sia/Documents/New project"
npm test
```

## 배포 가이드 (Node 서버형)
이 프로젝트는 정적 호스팅만으로는 동작하지 않고, Node 프로세스를 실행하는 Web Service(웹 서비스)가 필요합니다.

배포 체크포인트:
1. Start Command(시작 명령): `npm start`
2. `HOST=0.0.0.0` 설정 (외부 라우팅 허용)
3. `PORT`는 플랫폼 제공 값을 사용하거나 환경 변수로 지정
4. `WAQI_TOKEN` 설정 권장

배포 후 검증:
1. `GET /api/health`가 `{"ok":true}` 반환
2. `GET /api/recommendations` 응답의 `weather.source` 값 확인
   - `live`면 실시간 연동 정상
   - `fallback`이면 외부 API 실패를 폴백으로 처리 중

## 트러블슈팅
- `EADDRINUSE`:
  - 동일 포트를 다른 프로세스가 사용 중입니다.
  - 현재 서버는 자동으로 다음 포트를 재시도합니다.
- `EPERM listen ...`:
  - 실행 환경에서 소켓 바인딩 자체가 제한된 상태입니다.
  - 로컬 터미널(권한 있는 세션)에서 실행하거나 환경 제한을 해제해야 합니다.
- `날씨 API 요청에 실패했습니다.`:
  - DNS/네트워크 차단 또는 외부 API 장애일 수 있습니다.
  - 이 경우에도 앱은 폴백 날씨값으로 추천 카드를 유지합니다.

## 데이터 출처
- Open-Meteo Geocoding API: 위치 검색
- Open-Meteo Forecast API: 현재 날씨/일교차
- Open-Meteo Air Quality API: PM2.5/PM10/US-AQI
- WAQI API: 대기질 보강(fallback)
