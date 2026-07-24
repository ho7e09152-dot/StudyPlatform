# Study Workspace Frontend

GitLab 저장소를 원본으로 사용하는 팀 학습 일정·제출 관리 프론트엔드입니다.

## 실행

Node.js 22.13 이상이 필요합니다.

```bash
npm install
npm run dev
```

프로덕션 빌드와 검증:

```bash
npm run build
npm run lint
npm test
```

## 구조

```text
app/                         App Router 페이지와 메타데이터
components/providers/        Workspace 상태와 목업 API 동작
components/shell/            반응형 애플리케이션 셸
components/today/            오늘의 학습과 항목별 제출
components/schedule/         일정 생성·수정과 revision 처리
components/records/          저장소 데이터 기반 학습 통계
components/repository/       session.yml·멤버 Markdown 조회
components/settings/         연결·멤버·보안 설정
components/ui/               공통 UI 컴포넌트
lib/domain/                  도메인 타입·완료율 계산·포맷
lib/data/                    독립 Workspace 목업 데이터
lib/repository/              YAML·Markdown 직렬화
```

## 설계 기준

- GitLab 저장소가 학습 일정과 제출의 원본입니다.
- Workspace마다 GitLab 프로젝트 하나만 연결합니다.
- 모든 활성 멤버는 앱에서 동등한 관리 권한을 가집니다.
- 실제 쓰기는 각 사용자의 GitLab 권한을 다시 확인해야 합니다.
- 항목 ID는 생성 후 변경하지 않습니다.
- 제거된 항목은 삭제하지 않고 보관합니다.
- 완료율은 필수 활성 항목과 실제 멤버 제출로 계산합니다.

현재 프론트엔드는 백엔드 연동 전 검증을 위해 메모리 기반 목업 어댑터를 사용합니다.
`WorkspaceProvider`의 액션은 설계서의 Dashboard, Session, Submission API 응답으로 교체할 수 있게 분리되어 있습니다.
