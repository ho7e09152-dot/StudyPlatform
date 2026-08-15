# Repository 학습 기록 저장 구조

Study-ing은 Workspace마다 저장소 안의 학습 기록 위치와 경로 규칙을 관리합니다. 저장소가 원본이며 DB의 일정·제출 데이터는 빠른 조회와 동기화를 위한 상태입니다.

## 지원 버전

| 버전 | 용도 | 기본 경로 |
|---|---|---|
| V1 | 기존 호환 | `YYMMDD/session.yml`, `YYMMDD/{이름}.md` |
| V2 | 기존 Study-ing 관리 구조 | `.study-workspace/sessions/{연도}/{날짜}/...` |
| V3 | Workspace별 사용자 설정 구조 | 선택한 기준 경로 + 블록 규칙 |

V1/V2 Workspace는 연결할 때 현재 구조를 그대로 유지합니다. 사용자 설정이 있는 새 Workspace만 V3를 사용합니다.

## V3 저장 구조

사용자는 `YEAR`, `MONTH`, `DATE`, `DAY`, `NAME`, `ITEM` 블록을 한 줄 규칙에 배치합니다. 구분선 왼쪽은 폴더 구조이고 가장 오른쪽 슬롯은 파일 이름입니다. 기본 추천값은 다음과 같습니다.

```text
기준 경로: .study-workspace/sessions
폴더: YEAR / MONTH / DAY
파일: NAME.md

.study-workspace/sessions/
└── 2026/
    └── 08/
        └── 14/
            ├── 김서연.md
            └── 이민준.md
```

- `DATE`는 `260814`처럼 연·월·일을 모두 포함하는 전체 날짜이고, `DAY`는 `14`처럼 일자만 표현합니다.
- 날짜와 작성자를 식별할 수 있도록 전체 경로에 `DATE` 또는 유효한 `YEAR/MONTH/DAY` 조합과 `NAME`이 필요합니다.
- 블록은 전체 경로에서 중복 사용할 수 없습니다.
- 폴더의 시간 블록은 `YEAR → MONTH → DATE` 또는 `YEAR → MONTH → DAY` 순서를 유지합니다. 전체 날짜를 월 아래에 둔 `MONTH/DATE`도 허용하지만 `DATE`와 `DAY`는 같은 일자를 중복 표현하므로 함께 사용할 수 없습니다. UI는 유효한 삽입 위치만 허용하고 서버도 같은 규칙을 검증합니다.
- 추천 구조는 `YEAR=YYYY`, `MONTH=MM`, `DAY=DD`를 사용합니다.
- `DATE`는 위치와 무관하게 `YYYY-MM-DD`, `YYYYMMDD`, `YY-MM-DD`, `YYMMDD`처럼 항상 전체 날짜를 표현합니다. `DAY`는 `DD` 또는 `DD_KO`(`14일`)만 사용합니다.
- 파일 이름 슬롯은 정확히 하나의 `DATE` 또는 `NAME`만 허용합니다. 파일 이름으로 사용한 블록은 폴더에서 사용할 수 없으며, 파일 이름을 교체하면 이전 블록은 유효한 폴더 위치로 이동합니다.
- 파일이 `NAME.md`이면 날짜 식별 블록은 폴더에, 파일이 `DATE.md`이면 작성자를 식별하는 `NAME`은 폴더에 둡니다.
- `DAY`만으로는 날짜를 복원할 수 없으므로 별도 `YEAR/MONTH` 또는 연도를 포함하는 `MONTH` 포맷이 필요합니다. 전체 `DATE`를 선택하면 별도의 `DAY`는 사용하지 않습니다.
- 한글 단위가 필요한 경우 연도(`2026년/26년`), 월(`08월/8월`), 전체 월(`2026년-08월/26년-08월`), 전체 날짜(`2026년-08월-14일/26년-08월-14일`) 포맷을 선택할 수 있습니다.
- 현재 파일 확장자는 Markdown(`.md`)만 지원합니다.
- `ITEM`을 폴더에 사용하면 항목별 파일 경로를 만들고 DB에서는 멤버별 제출 상태로 다시 합칩니다.
- 내부 일정 metadata는 선택한 기준 경로 아래 `.study-ing/sessions/{YYYY-MM-DD}.yml`에 둡니다. 사용자 Preview에서는 학습 기록 경로 이해에 필요한 파일만 보여줍니다.

V3 설정은 `.study-workspace/config.yml`에 기록합니다. 설정에는 schema version, 기준 경로, 블록 순서와 날짜 포맷만 포함되며 OAuth credential이나 개인 설정은 포함하지 않습니다.

## 기존 Repository 감지

Workspace 연결 분석은 LLM을 사용하지 않고 tree 경로의 반복 패턴을 계산합니다. 현재 감지하는 대표 형태는 다음과 같습니다.

```text
{base}/{YYMMDD}/{name}.md
{base}/{name}/{YYMMDD}.md
{base}/{year}/{month}/{date}/{name}.md
```

Markdown 파일 중 같은 후보 패턴이 2개 이상이며 반복률이 60% 이상일 때만 `DETECTED`로 제안합니다. 신뢰도가 낮으면 추천 구조를 보여주고 사용자가 직접 지정하게 합니다. 감지는 파일을 읽거나 이동하지 않으며, 선택 결과는 이후 새 학습 기록의 경로 규칙으로 사용합니다.

감지된 날짜와 현재 Workspace 멤버 이름이 일치하는 일반 Markdown은 파일을 수정하지 않고 `기존 학습 기록` 항목으로 읽습니다. 다른 멤버의 파일은 그 사용자가 Workspace에 참여한 뒤 동기화할 수 있습니다. 원본에 Study-ing metadata가 없으므로 기존 Markdown 안의 세부 항목 의미까지 추측하지는 않습니다. 사용자가 해당 기록을 수정할 때부터 그 파일에 Study-ing metadata를 기록합니다.

## 기존 파일 보호

- Workspace 생성 과정에서는 기존 파일을 이동하거나 이름을 바꾸지 않습니다.
- `.study-workspace/config.yml` 외에는 생성 시점에 새 파일을 만들지 않습니다.
- 사용자가 선택한 학습 기록 영역 밖의 파일은 읽기 목록에는 나타날 수 있지만 Study-ing 쓰기 대상이 아닙니다.
- 구조 변경과 파일 migration은 생성 흐름과 분리된 명시적 작업이어야 합니다.
- 저장소 분석 이후 tree fingerprint가 달라지면 생성을 중단하고 재분석합니다.

## 제출 커밋 규칙

Workspace 소유자와 관리자는 Settings의 `커밋 규칙`에서 제출 커밋 메시지 기본값과 제출 화면 안내 문구를 관리합니다.

- 기본 규칙: `{action}: {name} · {date} · {item}`
- 지원 변수: `{action}`, `{name}`, `{date}`, `{item}`, `{itemId}`, `{session}`
- 제출자는 저장 전에 최종 메시지를 수정할 수 있습니다.
- 서버는 제어 문자를 제거하고 200자 이내로 검증합니다.

## V1 → V2 기존 migration

기존 설정의 **저장 구조 정리**는 V1을 V2로 옮기는 별도 기능입니다. tree fingerprint와 대상 충돌을 검사한 뒤 GitLab의 단일 multi-action commit으로 처리합니다. 이 기능은 V3 구조 빌더와 자동 연결되지 않으며 Workspace 생성 중에는 실행되지 않습니다.
