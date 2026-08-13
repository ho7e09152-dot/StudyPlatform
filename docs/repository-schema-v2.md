# GitLab 저장 구조 V2

Study-ing이 새로 만드는 Workspace는 학습 데이터를 저장소 루트에 흩어 놓지 않고 서비스 전용 경로에 모읍니다.

```text
.study-workspace/
├── config.yml
└── sessions/
    └── 2026/
        └── 2026-08-10/
            ├── session.yml
            └── submissions/
                ├── 김서연.md
                └── 이민준.md
```

## 설계 원칙

- `config.yml`의 `repositorySchemaVersion`이 현재 구조 버전을 나타냅니다.
- 일정 파일은 `sessions/{연도}/{YYYY-MM-DD}/session.yml`에 저장합니다.
- 멤버 제출 파일은 같은 날짜의 `submissions/` 아래에 저장합니다.
- 사용자에게 보이는 제출 파일명은 프로필에서 정한 이름을 사용합니다.
- GitLab은 원본이고 DB의 일정·제출 데이터는 빠른 조회와 동기화를 위한 캐시입니다.

## 기존 V1 저장소 호환

기존 `YYMMDD/session.yml`, `YYMMDD/{멤버}.md` 구조는 계속 읽고 쓸 수 있습니다. 연결 시 자동으로 파일을 이동하지 않습니다. Owner가 설정의 **저장 구조 정리**를 명시적으로 실행할 때만 V2로 변경합니다.

마이그레이션은 다음 순서로 동작합니다.

1. 저장소 tree를 읽어 이동 대상과 충돌을 미리 보여줍니다.
2. 미리보기 시점의 tree fingerprint를 저장합니다.
3. 실행 직전에 tree를 다시 읽고 fingerprint가 달라졌으면 중단합니다.
4. GitLab Commit API의 여러 `move` action과 `config.yml` 변경을 단일 커밋으로 수행합니다.
5. 커밋 성공 후 Workspace DB의 스키마 버전을 V2로 바꾸고 GitLab 원본을 다시 동기화합니다.

다음 조건에서는 자동 마이그레이션을 중단합니다.

- `.study-workspace` 대상 경로가 다른 용도로 이미 사용 중인 경우
- 이동 대상 V2 파일이 이미 존재하는 경우
- 날짜 폴더 안에 서비스가 해석하지 못하는 파일이 있는 경우
- 미리보기 이후 저장소 tree가 변경된 경우
- 단일 안전 커밋 한도인 99개 이동 파일을 초과한 경우

## 롤백

모든 이동은 GitLab 커밋 하나로 남으므로 GitLab에서 해당 커밋을 revert하면 파일 구조를 되돌릴 수 있습니다. 되돌린 뒤에는 현재 Workspace의 `repositorySchemaVersion`과 실제 저장소 구조가 달라지므로 운영자가 DB 상태를 V1으로 복구하거나 Workspace를 다시 연결해야 합니다.
