"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type KeyboardEvent } from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  FileCheck2,
  FolderGit2,
  Gitlab,
  Menu,
  MessageSquareText,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { getDemoEntryUrl } from "@/lib/demo/session";

const coreValues = [
  {
    icon: BookOpenCheck,
    title: "오늘 할 일이 명확하게",
    description: "일정과 남은 학습을 한눈에 확인하고 바로 다음 학습을 시작합니다.",
  },
  {
    icon: MessageSquareText,
    title: "제출과 리뷰를 한곳에서",
    description: "GitLab을 직접 오가지 않고 학습 결과를 제출하고 팀 리뷰를 확인합니다.",
  },
  {
    icon: Search,
    title: "공부한 내용이 다시 쌓이게",
    description: "완료한 세션과 팀 문서를 다시 찾고 학습 흐름을 기록에서 확인합니다.",
  },
] as const;

const workflow = [
  { number: "01", title: "Workspace 연결", description: "GitLab 프로젝트를 Study-ing Workspace에 연결합니다." },
  { number: "02", title: "학습 일정 만들기", description: "팀이 함께 공부할 항목과 마감을 정합니다." },
  { number: "03", title: "학습하고 제출하기", description: "Today에서 학습을 진행하고 결과를 제출합니다." },
  { number: "04", title: "다시 찾고 돌아보기", description: "Library에서 내용을 찾고 Records에서 학습 흐름을 확인합니다." },
] as const;

const showcaseItems = [
  {
    id: "today",
    label: "오늘",
    icon: BookOpenCheck,
    title: "오늘 해야 할 일을 놓치지 않게.",
    description: "현재 학습, 남은 항목, 팀 진행 상황을 한 화면에서 확인합니다.",
    desktop: "/product-previews/today-desktop.webp",
    mobile: "/product-previews/today-mobile.webp",
    desktopSize: { width: 1200, height: 917 },
    mobileSize: { width: 390, height: 1676 },
    alt: "Study-ing 오늘 화면의 현재 학습과 팀 진행 상황",
  },
  {
    id: "schedule",
    label: "일정",
    icon: CalendarDays,
    title: "팀의 계획과 마감을 한눈에.",
    description: "목록과 캘린더에서 학습 계획을 확인하고 필요한 일정을 관리합니다.",
    desktop: "/product-previews/schedule-desktop.webp",
    mobile: "/product-previews/schedule-mobile.webp",
    desktopSize: { width: 1200, height: 917 },
    mobileSize: { width: 390, height: 1088 },
    alt: "Study-ing 일정 화면의 월간 캘린더와 일정 목록",
  },
  {
    id: "library",
    label: "라이브러리",
    icon: FolderGit2,
    title: "공부한 내용을 다시 찾기 쉽게.",
    description: "지난 학습 세션과 팀 문서를 학습 라이브러리에서 검색하고 다시 읽습니다.",
    desktop: "/product-previews/library-desktop.webp",
    mobile: "/product-previews/library-mobile.webp",
    desktopSize: { width: 1200, height: 875 },
    mobileSize: { width: 390, height: 1218 },
    alt: "Study-ing 학습 라이브러리의 세션 검색 목록",
  },
  {
    id: "records",
    label: "기록",
    icon: BarChart3,
    title: "학습 흐름을 숫자로 확인.",
    description: "주간·월간 완료율과 팀 참여 현황을 필요한 만큼만 확인합니다.",
    desktop: "/product-previews/records-desktop.webp",
    mobile: "/product-previews/records-mobile.webp",
    desktopSize: { width: 1200, height: 875 },
    mobileSize: { width: 390, height: 1421 },
    alt: "Study-ing 학습 기록의 주간 완료율과 팀 학습 현황",
  },
] as const;

type ShowcaseId = (typeof showcaseItems)[number]["id"];

export function LandingPage() {
  const [activeShowcase, setActiveShowcase] = useState<ShowcaseId>("today");
  const [menuOpen, setMenuOpen] = useState(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeItem = showcaseItems.find((item) => item.id === activeShowcase) ?? showcaseItems[0];

  const moveTabFocus = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    let nextIndex = currentIndex;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + showcaseItems.length) % showcaseItems.length;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % showcaseItems.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = showcaseItems.length - 1;
    setActiveShowcase(showcaseItems[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="public-landing">
      <header className="public-header">
        <div className="public-container public-header__inner">
          <Link className="public-brand" href="/" aria-label="Study-ing 홈">
            <Image src="/study-ing-icon.png" alt="" width={898} height={898} unoptimized priority />
            <strong>Study-ing</strong>
          </Link>

          <nav className={menuOpen ? "public-nav is-open" : "public-nav"} aria-label="제품 소개">
            <a href="#how-it-works" onClick={() => setMenuOpen(false)}>작동 방식</a>
            <a href="#core-values" onClick={() => setMenuOpen(false)}>주요 기능</a>
            <a href="#product-showcase" onClick={() => setMenuOpen(false)}>화면 미리보기</a>
          </nav>

          <div className="public-header__actions">
            <Link className="public-login-link" href="/login">로그인</Link>
            <Link className="button button--primary public-start-button" href="/login">시작하기 <ArrowRight size={15} aria-hidden="true" /></Link>
            <button
              type="button"
              className="public-menu-button"
              aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((current) => !current)}
            >
              {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="public-hero" aria-labelledby="landing-title">
          <div className="public-container public-hero__grid">
            <div className="public-hero__copy">
              <span className="public-label">팀 학습을 위한 Study-ing Workspace</span>
              <h1 id="landing-title">스터디의 계획부터 기록까지,<br />하나의 흐름으로.</h1>
              <p>오늘 할 일을 확인하고, 학습을 제출하고, 팀과 리뷰한 내용을 다시 찾아보세요.</p>
              <div className="public-hero__actions">
                <Link className="button button--primary public-primary-cta" href="/login">
                  <Gitlab size={18} aria-hidden="true" /> GitLab로 시작하기 <ArrowRight size={17} aria-hidden="true" />
                </Link>
                <Link className="button public-secondary-cta" href={getDemoEntryUrl()}>데모 둘러보기</Link>
              </div>
              <p className="public-hero__helper"><ShieldCheck size={15} aria-hidden="true" /> GitLab OAuth로 연결하며 개인 액세스 토큰을 직접 입력할 필요가 없습니다.</p>
            </div>

            <div className="public-hero-preview">
              <ProductScreenshot item={showcaseItems[0]} priority />
            </div>
          </div>
        </section>

        <section className="public-section public-values" id="core-values" aria-labelledby="core-values-title">
          <div className="public-container">
            <div className="public-section-heading">
              <span>Study-ing이 정리하는 흐름</span>
              <h2 id="core-values-title">관리할 것은 줄이고,<br />학습에 필요한 맥락은 이어갑니다.</h2>
            </div>
            <div className="public-values__grid">
              {coreValues.map(({ icon: Icon, title, description }) => (
                <article key={title}>
                  <Icon size={20} aria-hidden="true" />
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section public-workflow" id="how-it-works" aria-labelledby="how-it-works-title">
          <div className="public-container">
            <div className="public-section-heading public-section-heading--row">
              <div>
                <span>작동 방식</span>
                <h2 id="how-it-works-title">연결하고, 공부하고,<br />다시 꺼내보는 네 단계.</h2>
              </div>
              <p>GitLab 프로젝트를 연결한 뒤 실제 학습 과정은 Study-ing 안에서 자연스럽게 이어집니다.</p>
            </div>
            <ol className="public-workflow__list">
              {workflow.map((item) => (
                <li key={item.number}>
                  <span>{item.number}</span>
                  <div><h3>{item.title}</h3><p>{item.description}</p></div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="public-section public-showcase" id="product-showcase" aria-labelledby="showcase-title">
          <div className="public-container">
            <div className="public-section-heading">
              <span>실제 제품 화면</span>
              <h2 id="showcase-title">각 페이지가 하나의 학습 흐름으로 이어집니다.</h2>
              <p>현재 Study-ing에서 사용 중인 실제 화면을 확인해 보세요.</p>
            </div>

            <div className="public-showcase-tabs" role="tablist" aria-label="제품 화면 선택">
              {showcaseItems.map((item, index) => {
                const Icon = item.icon;
                const selected = activeShowcase === item.id;
                return (
                  <button
                    key={item.id}
                    ref={(element) => { tabRefs.current[index] = element; }}
                    type="button"
                    role="tab"
                    id={`showcase-tab-${item.id}`}
                    aria-controls={`showcase-panel-${item.id}`}
                    aria-selected={selected}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setActiveShowcase(item.id)}
                    onKeyDown={(event) => moveTabFocus(event, index)}
                  >
                    <Icon size={17} aria-hidden="true" /> {item.label}
                  </button>
                );
              })}
            </div>

            <div
              className="public-showcase-panel"
              id={`showcase-panel-${activeItem.id}`}
              role="tabpanel"
              aria-labelledby={`showcase-tab-${activeItem.id}`}
            >
              <div className="public-showcase-panel__copy">
                <h3>{activeItem.title}</h3>
                <p>{activeItem.description}</p>
                <Link href={getDemoEntryUrl(`/${activeItem.id}`)}>데모에서 확인하기 <ArrowRight size={15} aria-hidden="true" /></Link>
              </div>
              <div className="public-showcase-panel__image">
                <ProductScreenshot item={activeItem} />
              </div>
            </div>
          </div>
        </section>

        <section className="public-section public-trust" aria-labelledby="trust-title">
          <div className="public-container public-trust__surface">
            <div className="public-trust__copy">
              <span>Data &amp; Trust</span>
              <h2 id="trust-title">학습 기록은 내가 연결한 저장소에.</h2>
              <p>학습 일정과 제출 기록의 원본은 연결한 GitLab 프로젝트에 남습니다. 기존 저장소 파일은 그대로 유지합니다.</p>
            </div>
            <ul>
              <li><FolderGit2 size={18} aria-hidden="true" /><div><strong>원본이 남는 학습 기록</strong><span>일정과 제출 파일은 연결한 GitLab 프로젝트에서 계속 확인할 수 있습니다.</span></div></li>
              <li><ShieldCheck size={18} aria-hidden="true" /><div><strong>브라우저에 OAuth 토큰을 저장하지 않음</strong><span>토큰은 서버 DB에서 암호화해 관리하고 브라우저에는 HttpOnly 세션 쿠키만 사용합니다.</span></div></li>
              <li><FileCheck2 size={18} aria-hidden="true" /><div><strong>기존 파일은 그대로 유지</strong><span>Study-ing이 사용하는 학습 데이터 외 저장소 콘텐츠를 임의로 바꾸지 않습니다.</span></div></li>
            </ul>
          </div>
        </section>

        <section className="public-final-cta" aria-labelledby="final-cta-title">
          <div className="public-container public-final-cta__surface">
            <div>
              <span>다음 학습부터 더 선명하게</span>
              <h2 id="final-cta-title">스터디 관리보다 공부에 더 집중하세요.</h2>
              <p>GitLab 프로젝트를 연결하면 오늘의 학습부터 기록까지 한 흐름으로 시작할 수 있습니다.</p>
            </div>
            <div>
              <Link className="button button--primary public-primary-cta" href="/login">GitLab로 시작하기 <ArrowRight size={17} aria-hidden="true" /></Link>
              <Link className="button public-secondary-cta" href={getDemoEntryUrl()}>데모 둘러보기</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="public-footer">
        <div className="public-container">
          <div><strong>Study-ing</strong><span>팀 학습을 하나의 흐름으로.</span></div>
          <nav aria-label="정책 및 계정">
            <Link href="/terms?returnTo=/">이용약관</Link>
            <Link href="/privacy?returnTo=/">개인정보 처리 안내</Link>
            <Link href="/login">로그인</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function ProductScreenshot({ item, priority = false }: { item: (typeof showcaseItems)[number]; priority?: boolean }) {
  return (
    <picture>
      <source media="(max-width: 700px)" srcSet={item.mobile} />
      <Image
        src={item.desktop}
        alt={item.alt}
        width={item.desktopSize.width}
        height={item.desktopSize.height}
        sizes="(max-width: 700px) 358px, (max-width: 1100px) 78vw, 760px"
        priority={priority}
      />
    </picture>
  );
}
