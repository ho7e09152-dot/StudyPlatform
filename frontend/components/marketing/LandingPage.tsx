"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Code2,
  FileCode2,
  FolderGit2,
  GitBranch,
  GitCommitHorizontal,
  GitMerge,
  Layers3,
  LockKeyhole,
  MousePointer2,
  Play,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

const showcaseItems = [
  {
    id: "today",
    label: "오늘",
    eyebrow: "TODAY WORKSPACE",
    title: "오늘 할 일과 팀 진행률을 한 화면에서",
    description:
      "일정 변경, 항목별 제출 상태, 멤버 진행률을 확인하고 남은 학습으로 바로 이어갑니다.",
  },
  {
    id: "schedule",
    label: "일정",
    eyebrow: "SESSION MANAGEMENT",
    title: "여러 학습 항목과 두 번의 마감까지",
    description:
      "알고리즘·영어·CS 스터디를 유형별로 관리하고 1차·2차 제출 마감을 직관적으로 설정합니다.",
  },
  {
    id: "records",
    label: "기록",
    eyebrow: "LEARNING ANALYTICS",
    title: "쌓인 제출을 학습 흐름으로 바꿔서",
    description:
      "일별·월별 제출률과 점수를 그래프로 살펴보고 꾸준함을 다음 학습 계획으로 연결합니다.",
  },
  {
    id: "repository",
    label: "저장소",
    eyebrow: "GITLAB SOURCE OF TRUTH",
    title: "GitLab 기록은 그대로, 읽기는 더 편하게",
    description:
      "날짜 폴더와 Markdown을 웹에서 탐색하고 원문과 렌더링 결과를 필요에 따라 전환합니다.",
  },
] as const;

type ShowcaseId = (typeof showcaseItems)[number]["id"];

const workflow = [
  {
    icon: CalendarDays,
    number: "01",
    title: "일정을 만들고",
    description: "학습 항목과 제출 방식, 마감 시간을 정합니다.",
  },
  {
    icon: BookOpenCheck,
    number: "02",
    title: "웹에서 제출하면",
    description: "링크·텍스트·코드와 커밋 메시지를 함께 작성합니다.",
  },
  {
    icon: GitCommitHorizontal,
    number: "03",
    title: "GitLab에 기록되고",
    description: "개인 파일과 commit 이력이 저장소에 투명하게 남습니다.",
  },
  {
    icon: BarChart3,
    number: "04",
    title: "진행률로 이어집니다",
    description: "팀 현황, 기록과 점수를 원본 데이터에서 계산합니다.",
  },
];

const features = [
  {
    icon: Layers3,
    tone: "violet",
    label: "MULTI STUDY",
    title: "하나의 Workspace에서 여러 스터디",
    description:
      "알고리즘, 영어, CS, 자유주제를 같은 구조로 관리하면서 필요한 제출 방식만 골라 사용합니다.",
    tags: ["링크", "텍스트", "코드"],
  },
  {
    icon: GitMerge,
    tone: "blue",
    label: "SAFE SYNC",
    title: "다른 기록을 지우지 않는 안전한 병합",
    description:
      "항목 하나를 수정해도 나머지 제출은 유지하고 revision과 commit ID로 동시 수정을 감지합니다.",
    tags: ["revision", "last_commit_id"],
  },
  {
    icon: BarChart3,
    tone: "mint",
    label: "VISIBLE PROGRESS",
    title: "확인이 아닌 응원으로 바뀌는 진행률",
    description:
      "제출 여부를 매번 묻지 않아도 팀 현황과 개인의 꾸준함을 같은 기준으로 확인할 수 있습니다.",
    tags: ["일별·월별", "10P · 6P"],
  },
];

export function LandingPage() {
  const [activeShowcase, setActiveShowcase] = useState<ShowcaseId>("today");

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduceMotion.matches) return;

    const timer = window.setInterval(() => {
      setActiveShowcase((current) => {
        const index = showcaseItems.findIndex((item) => item.id === current);
        return showcaseItems[(index + 1) % showcaseItems.length].id;
      });
    }, 4600);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14 },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  const current =
    showcaseItems.find((item) => item.id === activeShowcase) ?? showcaseItems[0];

  return (
    <div className="landing-page">
      <header className="marketing-header">
        <Link className="marketing-brand" href="/" aria-label="STUDY 홈">
          <Image
            src="/ssafy_icon.png"
            alt="SSAFY"
            width={684}
            height={354}
            priority
            unoptimized
          />
          <span>
            <strong>STUDY</strong>
            <small>GitLab learning hub</small>
          </span>
        </Link>
        <nav aria-label="랜딩 페이지 메뉴">
          <a href="#workflow">작동 방식</a>
          <a href="#features">핵심 기능</a>
          <a href="#showcase">화면 미리보기</a>
        </nav>
        <div className="marketing-header__actions">
          <Link className="marketing-login-link" href="/login">
            로그인
          </Link>
          <Link className="button marketing-button marketing-button--small" href="/login">
            시작하기 <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="hero-glow hero-glow--one" aria-hidden="true" />
          <div className="hero-glow hero-glow--two" aria-hidden="true" />
          <div className="landing-container landing-hero__grid">
            <div className="landing-hero__copy">
              <div className="landing-pill">
                <span className="landing-pill__pulse" />
                GitLab 기록에서 바로 시작하는 스터디
              </div>
              <h1>
                흩어진 학습 기록을
                <br />
                <span>함께 움직이는 Workspace로.</span>
              </h1>
              <p>
                일정부터 항목별 제출, GitLab commit, 진행률과 점수까지.
                <br />
                스터디가 실제로 굴러가는 흐름을 한곳에 연결합니다.
              </p>
              <div className="landing-hero__actions">
                <Link className="button marketing-button" href="/login">
                  GitLab로 시작하기 <ArrowRight size={17} />
                </Link>
                <Link className="button marketing-button--ghost" href="/today">
                  <Play size={16} fill="currentColor" /> 데모 둘러보기
                </Link>
              </div>
              <ul className="landing-proof" aria-label="서비스 핵심 원칙">
                <li><Check size={14} /> GitLab이 원본</li>
                <li><Check size={14} /> 브라우저에 토큰 저장 안 함</li>
                <li><Check size={14} /> 팀원별 투명한 기록</li>
              </ul>
            </div>

            <div className="hero-visual" aria-label="Study Workspace 제품 미리보기">
              <div className="hero-orbit hero-orbit--one" aria-hidden="true" />
              <div className="hero-orbit hero-orbit--two" aria-hidden="true" />
              <div className="hero-product">
                <div className="hero-product__bar">
                  <span />
                  <span />
                  <span />
                  <div>study.workspace/today</div>
                </div>
                <div className="hero-product__body">
                  <aside>
                    <div className="hero-product__mini-brand">
                      <Image
                        src="/ssafy_icon.png"
                        alt=""
                        width={684}
                        height={354}
                        unoptimized
                      />
                      <b>STUDY</b>
                    </div>
                    <span className="active"><Layers3 size={12} /> 오늘</span>
                    <span><CalendarDays size={12} /> 일정</span>
                    <span><BarChart3 size={12} /> 기록</span>
                    <span><FolderGit2 size={12} /> 저장소</span>
                    <div className="hero-product__sync">
                      <i /> GitLab 연결됨
                    </div>
                  </aside>
                  <div className="hero-dashboard">
                    <div className="hero-dashboard__heading">
                      <div>
                        <small>2026년 7월 26일 · TODAY</small>
                        <strong>오늘의 학습</strong>
                      </div>
                      <span>이어서 제출하기</span>
                    </div>
                    <div className="hero-dashboard__metrics">
                      <article>
                        <span>팀 완료</span>
                        <strong>2<small>/3명</small></strong>
                        <div className="mini-ring">67%</div>
                      </article>
                      <article>
                        <span>전체 제출</span>
                        <strong>5<small>/6건</small></strong>
                        <div className="mini-progress"><i /></div>
                      </article>
                      <article>
                        <span>내 진행</span>
                        <strong>1<small>/2개</small></strong>
                        <div className="mini-progress mini-progress--mint"><i /></div>
                      </article>
                    </div>
                    <div className="hero-dashboard__session">
                      <header>
                        <span>ALG · 알고리즘</span>
                        <small><Clock3 size={10} /> 23:59 마감</small>
                      </header>
                      <strong>큐와 배열 집중 학습</strong>
                      <div className="hero-task">
                        <i><Check size={10} /></i>
                        <span><b>행렬 테두리 회전하기</b><small>링크 제출 · 완료</small></span>
                        <em>수정</em>
                      </div>
                      <div className="hero-task">
                        <i>2</i>
                        <span><b>프로세스</b><small>링크 제출 · 미제출</small></span>
                        <em className="primary">제출</em>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="floating-commit floating-commit--top">
                <span><GitCommitHorizontal size={16} /></span>
                <div><small>방금 GitLab에 반영됨</small><strong>study: 프로세스 풀이 제출</strong></div>
                <i />
              </div>
              <div className="floating-commit floating-commit--bottom">
                <span><Users size={16} /></span>
                <div><small>TEAM PROGRESS</small><strong>오늘 2명이 완료했어요</strong></div>
                <ChevronRight size={15} />
              </div>
              <div className="hero-cursor" aria-hidden="true">
                <MousePointer2 size={20} fill="currentColor" />
                <span>김서연</span>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-trust">
          <div className="landing-container">
            <p>저장소 구조는 그대로 유지하면서</p>
            <div>
              <span><GitBranch size={17} /> GitLab REST API</span>
              <span><FileCode2 size={17} /> Markdown + YAML</span>
              <span><ShieldCheck size={17} /> OAuth · HttpOnly Session</span>
              <span><Code2 size={17} /> Spring Boot + React</span>
            </div>
          </div>
        </section>

        <section className="landing-section workflow-section" id="workflow">
          <div className="landing-container">
            <div className="landing-section__heading" data-reveal>
              <span className="landing-kicker">ONE CONNECTED FLOW</span>
              <h2>스터디의 반복 작업을<br />하나의 흐름으로</h2>
              <p>Git을 잘 몰라도 기록은 GitLab에 정확히 남고, 팀은 같은 기준으로 진행 상황을 봅니다.</p>
            </div>
            <div className="workflow-grid">
              {workflow.map((item, index) => {
                const Icon = item.icon;
                return (
                  <article key={item.number} data-reveal style={{ "--delay": `${index * 90}ms` } as React.CSSProperties}>
                    <div className="workflow-icon"><Icon size={21} /></div>
                    <span>{item.number}</span>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    {index < workflow.length - 1 ? <ArrowRight className="workflow-arrow" size={18} /> : null}
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="landing-section feature-section" id="features">
          <div className="landing-container">
            <div className="landing-section__heading landing-section__heading--split" data-reveal>
              <div>
                <span className="landing-kicker">DESIGNED FOR REAL STUDY</span>
                <h2>확인에 쓰던 시간을<br />학습에 돌려주세요</h2>
              </div>
              <p>블로그, GitLab, 메신저에 나뉜 기록을 억지로 옮기지 않고 각 도구가 잘하는 역할을 이어줍니다.</p>
            </div>
            <div className="feature-grid">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <article
                    className={`feature-card feature-card--${feature.tone}`}
                    key={feature.title}
                    data-reveal
                    style={{ "--delay": `${index * 100}ms` } as React.CSSProperties}
                  >
                    <div className="feature-card__top">
                      <span><Icon size={21} /></span>
                      <small>{feature.label}</small>
                    </div>
                    <h3>{feature.title}</h3>
                    <p>{feature.description}</p>
                    <div className="feature-tags">
                      {feature.tags.map((tag) => <span key={tag}>{tag}</span>)}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="landing-section showcase-section" id="showcase">
          <div className="landing-container">
            <div className="landing-section__heading" data-reveal>
              <span className="landing-kicker">A WORKSPACE THAT EXPLAINS ITSELF</span>
              <h2>필요한 정보가, 필요한 순간에</h2>
              <p>페이지를 옮겨 다니며 파일을 대조하지 않아도 현재 상태와 다음 행동이 자연스럽게 이어집니다.</p>
            </div>
            <div className="showcase-shell" data-reveal>
              <div className="showcase-tabs" role="tablist" aria-label="화면 미리보기">
                {showcaseItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={activeShowcase === item.id}
                    onClick={() => setActiveShowcase(item.id)}
                  >
                    {item.label}
                    {activeShowcase === item.id ? <span /> : null}
                  </button>
                ))}
              </div>
              <div className="showcase-content" key={current.id}>
                <div className="showcase-copy">
                  <span>{current.eyebrow}</span>
                  <h3>{current.title}</h3>
                  <p>{current.description}</p>
                  <Link href={current.id === "today" ? "/today" : `/${current.id}`}>
                    데모에서 확인하기 <ArrowRight size={15} />
                  </Link>
                </div>
                <ShowcasePreview active={current.id} />
              </div>
            </div>
          </div>
        </section>

        <section className="landing-security">
          <div className="landing-container landing-security__grid" data-reveal>
            <div className="landing-security__icon"><LockKeyhole size={28} /></div>
            <div>
              <span className="landing-kicker">SECURE BY BOUNDARY</span>
              <h2>GitLab 토큰은 브라우저에 남기지 않습니다.</h2>
              <p>Spring 백엔드가 로그인 사용자와 Workspace 권한을 확인한 뒤 연결된 프로젝트의 허용된 경로만 호출합니다.</p>
            </div>
            <ul>
              <li><Check size={15} /> HttpOnly 세션 쿠키</li>
              <li><Check size={15} /> 서버에서 파일 경로 계산</li>
              <li><Check size={15} /> commit 충돌 감지</li>
            </ul>
          </div>
        </section>

        <section className="landing-cta">
          <div className="landing-cta__orb" aria-hidden="true" />
          <div className="landing-container" data-reveal>
            <span><Sparkles size={16} /> 이제 파일을 확인하러 다니지 마세요</span>
            <h2>팀의 학습 흐름을<br />하나의 Workspace에서 시작하세요.</h2>
            <p>GitLab 저장소는 그대로. 일정과 제출, 기록은 더 선명하게.</p>
            <div>
              <Link className="button marketing-button marketing-button--light" href="/login">
                GitLab로 시작하기 <ArrowRight size={17} />
              </Link>
              <Link className="button marketing-button--outline" href="/today">
                데모 Workspace 열기
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="marketing-footer">
        <div className="landing-container">
          <Link className="marketing-brand marketing-brand--footer" href="/">
            <Image src="/ssafy_icon.png" alt="SSAFY" width={684} height={354} unoptimized />
            <span><strong>STUDY</strong><small>GitLab learning hub</small></span>
          </Link>
          <p>GitLab 저장소를 학습 기록의 원본으로 유지하는 팀 스터디 Workspace</p>
          <div><a href="#workflow">작동 방식</a><a href="#features">핵심 기능</a><Link href="/login">로그인</Link></div>
        </div>
      </footer>
    </div>
  );
}

function ShowcasePreview({ active }: { active: ShowcaseId }) {
  if (active === "schedule") {
    return (
      <div className="showcase-preview showcase-preview--schedule">
        <header><span>학습 일정</span><button type="button">+ 새 일정</button></header>
        <div className="showcase-filter"><i /><i /><i className="active" /><i /></div>
        <div className="showcase-schedule-grid">
          <article><small>7월 24일 금</small><b>영어 표현과 듣기</b><span>ENG</span><div><i /></div></article>
          <article className="active"><small>7월 26일 일</small><b>큐와 배열 집중 학습</b><span>ALG</span><div><i /></div></article>
          <article><small>7월 28일 화</small><b>운영체제 스케줄링</b><span>CS</span><div><i /></div></article>
        </div>
      </div>
    );
  }

  if (active === "records") {
    return (
      <div className="showcase-preview showcase-preview--records">
        <header><span>학습 기록</span><small>2026년 7월</small></header>
        <div className="showcase-record-stats">
          <article><b>71%</b><small>평균 제출률</small></article>
          <article><b>4일</b><small>학습한 날</small></article>
          <article><b>30P</b><small>현재 점수</small></article>
        </div>
        <div className="showcase-chart">
          {[14, 76, 98, 64, 18, 8, 4].map((height, index) => (
            <i key={index} style={{ height: `${height}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (active === "repository") {
    return (
      <div className="showcase-preview showcase-preview--repository">
        <header><span>GitLab Files</span><small>main</small></header>
        <div className="showcase-repo-body">
          <aside>
            <b>📁 260726/</b>
            <span>session.yml</span>
            <span className="active">member-a.md</span>
            <span>member-b.md</span>
          </aside>
          <div>
            <small>member-a.md · 미리보기</small>
            <h4>큐와 배열 집중 학습</h4>
            <p>행렬 테두리 회전하기</p>
            <i />
            <i />
            <i className="short" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="showcase-preview showcase-preview--today">
      <header><span>오늘의 학습</span><button type="button">이어서 제출</button></header>
      <div className="showcase-today-stats">
        <article><small>팀 완료</small><b>2/3명</b><i /></article>
        <article><small>전체 제출</small><b>5/6건</b><i /></article>
        <article><small>내 진행</small><b>1/2개</b><i /></article>
      </div>
      <div className="showcase-today-task"><Check size={13} /><span><b>행렬 테두리 회전하기</b><small>제출 완료</small></span><em>수정</em></div>
      <div className="showcase-today-task"><span>2</span><span><b>프로세스</b><small>미제출</small></span><em className="active">제출</em></div>
    </div>
  );
}
