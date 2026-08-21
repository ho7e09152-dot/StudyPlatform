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

사용자는 `YEAR`, `MONTH`, `DATE`, `DAY`, `NAME` 블록을 한 줄 규칙에 배치합니다. 구분선 왼쪽은 폴더 구조이고 가장 오른쪽 슬롯은 파일 이름입니다. 학습 항목별 파일 분리는 지원하지 않으며, 한 Session에서 한 Member의 제출 항목은 하나의 Markdown 파일에 함께 저장합니다. 기본 추천값은 다음과 같습니다.

```text
기준 경로: study
폴더: MONTH(YYYY-MM) / DAY
파일: NAME.md

study/
├── .study-workspace/
│   └── config.yml
└── 2026-08/
    └── 14/
        ├── session.yml
        ├── 김서연.md
        └── 이민준.md
```

- `DATE`는 `260814`처럼 연·월·일을 모두 포함하는 전체 날짜이고, `DAY`는 `14`처럼 일자만 표현합니다.
- 날짜와 작성자를 식별할 수 있도록 전체 경로에 `DATE` 또는 유효한 `YEAR/MONTH/DAY` 조합과 `NAME`이 필요합니다.
- 블록은 전체 경로에서 중복 사용할 수 없습니다.
- 폴더와 파일 이름을 합친 전체 Layout에서 같은 블록은 한 번만 사용할 수 있습니다.
- 시간 블록만 추출했을 때 `YEAR → MONTH → DATE 또는 DAY` 순서를 유지해야 합니다. `NAME`은 시간 순서 계산에서 제외합니다. 전체 날짜를 월 아래에 둔 `MONTH/DATE`도 허용하지만 `DATE`와 `DAY`는 함께 사용할 수 없습니다. UI는 유효한 삽입 위치만 허용하고 서버도 같은 규칙을 검증합니다.
- 추천 구조는 `MONTH=YYYY-MM`, `DAY=DD`를 사용하여 `study/2026-08/14/김서연.md`처럼 연·월 그룹을 유지하면서 폴더 깊이를 줄입니다.
- `DATE`는 위치와 무관하게 `YYYY-MM-DD`, `YYYYMMDD`, `YY-MM-DD`, `YYMMDD`처럼 항상 전체 날짜를 표현합니다. `DAY`는 `DD` 또는 `DD_KO`(`14일`)만 사용합니다.
- 파일 이름 슬롯은 정확히 하나의 `DATE` 또는 `NAME`만 허용합니다. 파일 이름으로 사용한 블록은 폴더에서 사용할 수 없으며, 파일 이름을 교체하면 이전 블록은 유효한 폴더 위치로 이동합니다.
- 파일이 `NAME.md`이면 날짜 식별 블록은 폴더에, 파일이 `DATE.md`이면 작성자를 식별하는 `NAME`은 폴더에 둡니다.
- `DAY`만으로는 날짜를 복원할 수 없으므로 별도 `YEAR/MONTH` 또는 연도를 포함하는 `MONTH` 포맷이 필요합니다. 전체 `DATE`를 선택하면 별도의 `DAY`는 사용하지 않습니다.
- 별도 `YEAR` 블록이 있으면 `MONTH`는 `MM`, `M`, `MM_KO`, `M_KO`만 사용합니다. `DATE`가 제공하는 연·월·일과 상위 폴더의 시간 정보가 중복되는 것은 grouping 목적으로 허용하지만, Repository Sync에서 서로 다른 값이 발견되면 `TEMPORAL_COMPONENT_MISMATCH`로 거부합니다.
- 월에 연도까지 포함하는 경우 구분자형(`2026-08/26-08`)과 숫자형(`202608/2608`)을 선택할 수 있습니다. 한글 단위가 필요한 경우 연도(`2026년/26년`), 월(`08월/8월`), 전체 월(`2026년-08월/26년-08월`), 전체 날짜(`2026년 08월 14일/26년 08월 14일`) 포맷을 선택할 수 있습니다. 기존 하이픈형 전체 날짜는 이미 연결된 Workspace의 역호환을 위해 계속 해석합니다.
- 2자리 연도는 모두 `2000~2099`로 해석합니다. 따라서 `00=2000`, `26=2026`, `99=2099`입니다.
- 현재 파일 확장자는 Markdown(`.md`)만 지원합니다.
- 일정 metadata인 `session.yml`은 같은 Layout의 시간 블록만 투영한 경로에 저장합니다. 예를 들어 `YEAR/MONTH/NAME | DATE.md`라면 제출은 `2026/08/김서연/260814.md`, metadata는 `2026/08/260814/session.yml`입니다. 이 규칙으로 모든 허용 Layout에서 Session 날짜와 Member identity를 역으로 복원할 수 있습니다.
- Preview는 실제 resolver와 같은 규칙으로 `session.yml`과 Member Markdown 경로를 표시합니다.

### 경로 안전성

- 기준 경로는 Repository-relative path이며 신규 Workspace의 추천값은 `study`입니다. 빈 값은 root를 뜻합니다. leading slash, `//`, `.`/`..`, Windows separator, 제어 문자, Unicode Format(`Cf`) 문자, `.git` 및 `.study-workspace` segment를 허용하지 않습니다. trailing slash만 저장 전에 제거합니다.
- 잘못된 raw path를 먼저 normalize하여 통과시키지 않습니다. 예를 들어 `study/../private`는 `private`로 보정하지 않고 거부합니다.
- `NAME`의 실제 값도 동일하게 한 개의 안전한 path segment인지 검사합니다. `/`, `\\`, `.`, `..`, NUL/제어 문자와 Unicode `Cf` 문자를 `_`나 `-`로 자동 변환하지 않습니다. 이 정책은 U+202A~U+202E와 U+2066~U+2069 같은 bidirectional control character를 포함합니다.
- Unicode normalization은 기존 Repository filename 호환성에 영향을 줄 수 있어 별도 정책이 확정되기 전까지 새로 적용하지 않습니다.
- 한 segment는 80자 및 UTF-8 255 bytes, 최종 resolved path는 240자 및 UTF-8 1024 bytes를 넘지 않게 검사합니다.
- Workspace 안의 실제 Member 이름으로 경로를 생성하여 대소문자를 무시한 충돌도 거부합니다. 기존 File을 Folder처럼 사용하는 기준 경로와 보호된 설정 파일 경로도 거부합니다.

V3 설정은 선택한 기준 경로의 `.study-workspace/config.yml`에 기록합니다. 기본값이라면 `study/.study-workspace/config.yml`입니다. 설정에는 schema version, 기준 경로, 블록 순서와 날짜 포맷만 포함되며 OAuth credential이나 개인 설정은 포함하지 않습니다.

초기 sandbox 점검과 Git 이력에서 V3 Layout 및 `itemCommitIds`가 저장된 운영·sandbox 데이터는 확인되지 않았습니다. `itemCommitIds`는 현재 Domain/API/Persistence 모델에서 제거했습니다. 과도기 코드로 생성된 JSON을 읽을 가능성만 고려해 `MemberSubmissionFile`의 Jackson ignore 목록에서 해당 property를 받아 버리며, 현재 state로 다시 직렬화하거나 API에 노출하지 않습니다.

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
- `{기준 경로}/.study-workspace/config.yml` 외에는 생성 시점에 새 파일을 만들지 않습니다.
- 사용자가 선택한 학습 기록 영역 밖의 파일은 읽기 목록에는 나타날 수 있지만 Study-ing 쓰기 대상이 아닙니다.
- 구조 변경과 파일 migration은 생성 흐름과 분리된 명시적 작업이어야 합니다.
- 현재는 저장소 분석 이후 tree fingerprint가 달라지면 생성을 중단하고 재분석합니다. Base Path와 생성 대상 경로만 재검증하는 방식은 Provider별 충돌 판정이 안정화된 후의 follow-up으로 남겨 둡니다.

## 제출 커밋 규칙

Workspace 소유자와 관리자는 Settings의 `커밋 규칙`에서 제출 커밋 메시지 기본값과 제출 화면 안내 문구를 관리합니다.

- 기본 규칙: `{action}: {name} · {date} · {item}`
- 지원 변수: `{action}`, `{name}`, `{date}`, `{item}`, `{itemId}`, `{session}`
- 제출자는 저장 전에 최종 메시지를 수정할 수 있습니다.
- 서버는 제어 문자를 제거하고 200자 이내로 검증합니다.

## V1 → V2 기존 migration

기존 설정의 **저장 구조 정리**는 V1을 V2로 옮기는 별도 기능입니다. tree fingerprint와 대상 충돌을 검사한 뒤 GitLab의 단일 multi-action commit으로 처리합니다. 이 기능은 V3 구조 빌더와 자동 연결되지 않으며 Workspace 생성 중에는 실행되지 않습니다.
