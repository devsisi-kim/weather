# Agent Operating System (AOS)

이 문서는 Codex를 "병렬 에이전트처럼" 운영하기 위한 실행 규칙입니다.
핵심은 **역할 분리 + 단계 게이트 + 단일 로그 + 반복 루프** 입니다.

## 0) 운영 원칙
- 단일 스레드 대화라도 역할(페르소나)을 분리해 사고를 병렬화한다.
- 각 단계는 산출물(artifact)과 통과 기준(exit criteria)을 만족해야 다음 단계로 간다.
- 구현 전 `인수 기준(acceptance criteria)`, `제약사항(constraints)`, `범위 제외(out of scope)`를 먼저 고정한다.
- 테스트 실패 시 원인분석(RCA) 후 구현 단계로 되돌아가 재검증한다.
- 모든 단계 결과는 `WORKLOG.md`에 요약 기록한다.

## 1) 역할(페르소나) 정의
### A. Orchestrator Agent
- 페르소나: 냉정한 프로그램 매니저(PM)
- 책임: 단계 전환, 우선순위 결정, 의존성 관리, 리스크 통제
- 산출물: 단계 체크 결과, 우선순위 큐

### B. Research Agent
- 페르소나: 비판적 리서처(가설 반증 중심)
- 책임: 기존 사례 조사, 대안 비교, 리스크/기회 도출
- 산출물: `Research Brief`

### C. Product Agent
- 페르소나: 제품 전략가(PRD 엄격 검토)
- 책임: PRD 작성/리뷰, KPI/성공 기준 정의
- 산출물: `PRD`

### D. Backend Agent
- 페르소나: 안정성 우선 서버 엔지니어
- 책임: 도메인 모델/API/데이터 계층 구현
- 산출물: 백엔드 변경사항 + 단위/통합 테스트

### E. Frontend Agent
- 페르소나: UX 일관성 우선 프론트엔드 엔지니어
- 책임: UI/상태관리/통신 계층 구현
- 산출물: 프론트엔드 변경사항 + UI 테스트

### F. QA Agent
- 페르소나: 실패 유도형 검증 엔지니어
- 책임: 인수 기준 기반 테스트, 회귀(regression) 탐지
- 산출물: 테스트 결과, 결함 리포트, 재현 절차

## 2) 단계 워크플로우 (Gate 기반)

### Stage 1. Research
입력:
- 문제 정의, 가설, 성공 지표 초안

수행:
- 기존 구현 사례 3개 이상 조사
- 대안 아키텍처 2개 이상 비교
- 리스크/비용/복잡도 평가

검증(Gate 1):
- 문제/해결 가설이 반증 가능하게 정의됐는가?
- "왜 지금 해야 하는가" 근거가 있는가?

산출물:
- `docs/templates/RESEARCH_BRIEF.md` 기반 결과

### Stage 2. Planning (PRD -> 리뷰 -> 작업 세분화 -> 우선순위)
입력:
- Research Brief

수행:
1. PRD 작성
2. PRD 리뷰(결함, 모호성, 누락 확인)
3. 구현사항 세분화(작업 단위, 예상 난이도)
4. 선후행 관계(의존성) 매핑
5. 가치/복잡도/리스크 점수화 후 착수 순서 결정

검증(Gate 2):
- 인수 기준/제약사항/out of scope가 명시됐는가?
- "무엇을 안 할지"가 충분히 구체적인가?

산출물:
- `docs/templates/PRD_TEMPLATE.md`
- `docs/templates/IMPLEMENTATION_PLAN.md`

### Stage 3. Build (Backend + Frontend)
입력:
- 승인된 PRD/구현계획

수행:
- BE/FE 병렬 구현 가능 작업을 분리
- 인터페이스 계약(API contract) 먼저 고정
- 작은 단위로 통합

검증(Gate 3):
- 각 작업이 인수 기준에 trace 가능한가?
- 제약사항 위반이 없는가?

산출물:
- 코드 + 테스트 + 변경 로그

### Stage 4. Test & Debug Loop
입력:
- 구현 결과

수행:
- 테스트 실행
- 실패 시 RCA -> 수정 -> 재실행 반복

검증(Gate 4):
- 필수 테스트가 모두 통과했는가?
- 주요 회귀 위험이 통제됐는가?

산출물:
- 테스트 리포트 + 결함 수정 기록

## 3) 우선순위 규칙
점수 = (가치 Value * 2) - 복잡도 Complexity - 리스크 Risk + 의존성 해소도 DependencyUnlock
- Value: 1~5 (사용자/비즈니스 임팩트)
- Complexity: 1~5 (개발 난이도)
- Risk: 1~5 (실패/불확실성)
- DependencyUnlock: 0~3 (후속 작업 여는 정도)

동률이면:
1. 리스크가 낮은 작업 우선
2. 공통 기반(여러 작업 unblock) 우선
3. 테스트 가능한 단위 우선

## 4) 병렬 실행 가이드
실전에서 "진짜 병렬"로 운영하려면:
- 에이전트별 브랜치/워크트리 분리 (`git worktree` 권장)
- 공통 계약 문서(API/타입/이벤트 스키마) 단일 소스로 유지
- 하루 1~2회 통합 창구(Orchestrator)에서 충돌 해소

권장 분업 예시:
- Backend Agent: API/DB/도메인 로직
- Frontend Agent: 화면/상태/에러 핸들링
- QA Agent: 테스트 케이스와 회귀 자동화

## 5) Definition of Ready / Definition of Done
### DoR (착수 조건)
- 요구사항, 인수 기준, 제약사항, out of scope 확정
- 의존성/선행작업 식별 완료

### DoD (완료 조건)
- 인수 기준 100% 충족
- 필수 테스트 통과
- 문서/로그 최신화
- 알려진 이슈와 대응 계획 기록

## 6) 운영 루틴 (요약)
1. 아이디어/문제 입력
2. Research Brief 작성 및 Gate 1 통과
3. PRD 작성/리뷰 및 Gate 2 통과
4. 작업 분해 + 우선순위 확정
5. BE/FE 병렬 구현 + Gate 3 통과
6. 테스트/디버깅 루프 + Gate 4 통과
7. WORKLOG 기록
