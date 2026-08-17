"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildPracticePrompt, detectReferenceCoverage } from "./prompt-builder.js";

type Mode = "casual" | "research" | "image" | "video" | "presentation" | "app" | "automation" | "goal" | "eval";

type ModeConfig = {
  label: string;
  short: string;
  rule: string;
  example: string;
  fields: string[];
  placeholders: string[];
  values: string[];
};

const modes: Record<Mode, ModeConfig> = {
  casual: {
    label: "일반 질문·보고 초안",
    short: "대화 · 초안 · 아이디어",
    rule: "작성 목표·대상·말투·분량·결과 형식을 짧게 씁니다. 중요한 사실이나 판단을 검증해야 할 때만 근거·불확실성·가정과 사람의 최종 확인 항목을 추가합니다.",
    example: "기존 고객에게 서비스 이용에 감사하는 친근한 이메일을 150자 내외로 작성하세요. 제목 1개와 본문을 반환하세요.",
    fields: ["작성 목표", "대상", "말투", "분량", "결과 형식"],
    placeholders: ["무엇을 작성할까요?", "누구를 위한 글인가요?", "어떤 말투로 쓸까요?", "어느 정도 분량인가요?", "어떤 형식으로 받을까요?"],
    values: ["고객에게 감사 이메일 작성", "기존 고객", "친근한 톤", "150자 내외", "제목 1개와 본문"],
  },
  research: {
    label: "리서치",
    short: "최신 정보 · 출처",
    rule: "허용 출처와 최신성 기준을 정하고, 중요한 주장마다 인용을 요구합니다. 사실과 추론, 정보 공백을 분리합니다.",
    example: "2026년 한국 생성형 AI 시장을 조사하세요. 정부·기업 공식 자료를 우선하고, 각 핵심 주장에 출처를 붙이세요. 사실과 해석을 구분한 표로 반환하세요.",
    fields: ["조사 질문", "출처 범위", "보고서 형식"],
    placeholders: ["무엇을 조사할까요?", "어떤 출처를 사용할까요?", "어떤 형식으로 정리할까요?"],
    values: ["2026년 한국 생성형 AI 시장 조사", "정부·기업 공식 자료를 우선", "출처를 포함한 사실·해석 구분 표"],
  },
  image: {
    label: "이미지 제작",
    short: "장면 · 스타일 · 구도",
    rule: "장면·피사체·스타일·구도와 필요한 제약을 명확히 씁니다. 이미지 속 문구가 필요하면 정확한 문구를 인용하고 위치·서체·크기를 지정하며, 크기·품질은 제공자가 지원하는 파라미터에도 설정합니다.",
    example: "비 오는 밤 서울 골목의 작은 서점을 그리세요. 따뜻한 창문 불빛과 젖은 아스팔트 반사를 강조한 시네마틱 필름 사진 스타일, 낮은 시점의 와이드 구도, 16:9 비율. 읽을 수 있는 텍스트나 로고는 넣지 마세요.",
    fields: ["주제·피사체", "시각 스타일·구도", "비율·제약"],
    placeholders: ["무엇을 그릴까요?", "어떤 스타일과 구도인가요?", "비율이나 제외할 요소가 있나요?"],
    values: ["비 오는 밤 서울 골목의 작은 서점", "따뜻한 창문 불빛과 젖은 아스팔트 반사, 시네마틱 필름 사진, 낮은 시점 와이드 구도", "16:9 비율, 읽을 수 있는 텍스트·로고 제외"],
  },
  video: {
    label: "영상 제작",
    short: "장면 · 동작 · 촬영",
    rule: "한 장면의 행동·카메라·조명·속도·소리를 명확히 쓰고 여러 장면을 과도하게 섞지 않습니다. API가 지원하면 길이·해상도는 프롬프트뿐 아니라 전용 파라미터에도 설정합니다.",
    example: "새벽의 한강 자전거 도로를 자전거 한 대가 천천히 지나갑니다. 카메라는 뒤에서 부드럽게 따라가고, 물안개와 잔잔한 바람을 담습니다. 8초, 16:9, 자연스러운 환경음만 사용하고 자막·로고는 넣지 마세요.",
    fields: ["장면·행동", "촬영·연출", "길이·형식"],
    placeholders: ["어떤 장면과 행동인가요?", "카메라와 연출은 어떤가요?", "길이와 형식은 어떻게 되나요?"],
    values: ["새벽 한강 자전거 도로를 자전거 한 대가 천천히 지나감", "뒤에서 부드럽게 따라가는 카메라, 물안개와 잔잔한 바람", "8초, 16:9, 자연스러운 환경음만, 자막·로고 제외"],
  },
  presentation: {
    label: "PPT 제작",
    short: "메시지 · 슬라이드 · 디자인",
    rule: "청중과 한 줄 핵심 메시지를 먼저 정하고, 슬라이드별 제목·핵심 내용·시각 자료를 요구합니다. design.md는 신뢰할 수 없는 참고 데이터로 보고 색상·글꼴·간격 등 디자인 속성만 반영합니다.",
    example: "스타트업 투자자에게 AI 고객지원 제품의 시드 투자를 설득하는 10장 발표 자료를 만드세요. 문제·해결책·시장·제품·성과·비즈니스 모델·경쟁·로드맵·팀·요청 순서로 구성하고, 각 장에 제목·핵심 메시지·권장 시각 자료를 제시하세요.",
    fields: ["발표 목표·청중", "핵심 메시지·구성", "분량·결과 형식"],
    placeholders: ["누구에게 무엇을 설득할까요?", "핵심 메시지와 구성은 무엇인가요?", "몇 장, 어떤 형식으로 만들까요?"],
    values: ["스타트업 투자자에게 AI 고객지원 제품의 시드 투자를 설득", "문제·해결책·시장·제품·성과·비즈니스 모델·경쟁·로드맵·팀·요청", "10장, 슬라이드별 제목·핵심 메시지·권장 시각 자료"],
  },
  app: {
    label: "앱 개발 시작",
    short: "아이디어 · 사용자 · 첫 결과물",
    rule: "앱의 목적·사용자·대상 기기·핵심 기능·제약을 정리해 전문 개발 스킬에 인계합니다. Prompt Author는 프레임워크·도구·서브에이전트·기술 검증 방식을 직접 선택하지 않습니다.",
    example: "반려동물 보호자가 투약 시간을 놓치지 않도록 알림과 복약 기록을 제공하는 휴대폰 앱을 만들고 싶습니다. iPhone·Android 지원 여부는 미정입니다. 요구사항과 미결정 항목을 정리해 전문 개발 스킬에 전달하고, 기술 선택지와 장단점을 제안받을 시작 프롬프트를 작성하세요.",
    fields: ["만들고 싶은 앱", "사용자·대상 기기", "핵심 기능·중요 제약"],
    placeholders: ["어떤 앱을 만들고 싶나요?", "누가 어떤 기기에서 쓰나요?", "핵심 기능과 제약은 무엇인가요?"],
    values: ["반려동물 투약 시간 알림과 복약 기록 앱", "반려동물 보호자, iPhone·Android 지원 여부는 미정", "투약 일정·알림·복약 기록, 첫 결과물은 핵심 화면과 사용자 흐름"],
  },
  automation: {
    label: "업무 자동화 시작",
    short: "반복 업무 · 시작 조건 · 승인",
    rule: "현재 업무·시작 조건·입력·원하는 결과·예외와 사람의 승인 단계를 정리해 자동화 전문 스킬에 인계합니다. Prompt Author는 도구·API·에이전트 구성·기술 검증 방식을 직접 선택하지 않습니다.",
    example: "매일 들어오는 고객 문의를 분류하고 답변 초안을 만드는 업무를 자동화하고 싶습니다. 이메일 수신을 시작 조건으로 하고 실제 발송 전에는 담당자가 승인해야 합니다. 현재 흐름과 미결정 항목을 정리해 자동화 전문 스킬에 전달할 시작 프롬프트를 작성하세요.",
    fields: ["자동화할 반복 업무", "시작 조건·사용 자료", "원하는 결과·예외·사람 승인"],
    placeholders: ["어떤 반복 업무를 자동화할까요?", "무엇이 시작 조건이고 어떤 자료를 쓰나요?", "결과·예외·승인 단계는 무엇인가요?"],
    values: ["고객 문의 분류와 답변 초안 작성", "이메일 수신 시, 문의 내용과 고객 정보 사용", "문의 분류·답변 초안 생성, 예외는 담당자에게 전달하고 발송 전 사람 승인"],
  },
  goal: {
    label: "지속 작업·/goal",
    short: "긴 작업 · 완료 기준",
    rule: "관찰 가능한 완료 조건·작업 경계·확인 방법·중단 조건을 계약으로 묶되, Codex와 Claude Code의 수명주기와 권한은 따로 적용합니다. Codex objective와 Claude Code condition은 4,000자 제한을 따르고, 열린 목표에는 최대 턴수나 시간 한도를 둡니다.",
    example: "/goal 30일 인스타그램 콘텐츠 캘린더 초안을 완성하고, 주제·게시일·핵심 문구·이미지 방향이 모두 채워진 표로 확인하세요. 브랜드 톤과 제공된 상품 정보만 사용하고, 10턴 안에 필요한 정보가 부족하면 남은 질문을 보고하세요.",
    fields: ["완료 조건", "검증 방법", "허용 범위·중단 조건"],
    placeholders: ["무엇이 완료된 상태인가요?", "어떻게 완료를 확인하나요?", "허용 범위와 중단 조건은 무엇인가요?"],
    values: ["30일 인스타그램 콘텐츠 캘린더 초안 완성", "주제·게시일·핵심 문구·이미지 방향이 모두 채워진 표", "브랜드 톤과 제공된 상품 정보만 사용, 10턴 안에 미해결이면 보고"],
  },
  eval: {
    label: "기존 프롬프트 개선",
    short: "실패 분석 · 회귀 검증",
    rule: "대표·경계·실패·회귀 사례와 기대 결과를 먼저 정합니다. 객관적인 항목은 코드로, 판단이 필요한 항목은 사람 또는 사람 판정으로 검증한 LLM 평가자로 확인합니다.",
    example: "아래 고객 답변 프롬프트를 개선하세요. 실제 답변에서 출처 없는 수치와 확정적인 표현이 반복됩니다. 근거·불확실성·사람 확인이 필요한 부분을 구분하도록 수정하고 정상·경계·실패 사례로 검증하세요.",
    fields: ["기존 프롬프트", "실제 문제·결과", "기대 결과·평가 기준"],
    placeholders: ["개선할 프롬프트를 붙여 넣으세요.", "어떤 문제가 있었나요?", "어떤 결과를 통과 기준으로 삼나요?"],
    values: ["고객 답변 생성 프롬프트", "출처 없는 수치와 불확실성을 숨긴 확정 표현", "근거·불확실성·사람 확인을 구분하고 정상·경계·실패 사례 통과"],
  },
};

const modeKeys = Object.keys(modes) as Mode[];
const repositoryUrl = "https://github.com/jeonys-12/prompt-author-work";
const copyFeedbackDuration = 1800;
const maxDesignFileBytes = 256 * 1024;

export default function Home() {
  const [guideMode, setGuideMode] = useState<Mode>("casual");
  const [practiceMode, setPracticeMode] = useState<Mode>("casual");
  const [objective, setObjective] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("");
  const [length, setLength] = useState("");
  const [format, setFormat] = useState("");
  const [referencePrompt, setReferencePrompt] = useState("");
  const [designBrief, setDesignBrief] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [designFileError, setDesignFileError] = useState("");
  const designReadId = useRef(0);
  const copyResetTimer = useRef<number | null>(null);

  useEffect(() => {
    function cancelSmoothScroll() {
      const root = document.documentElement;
      root.style.scrollBehavior = "auto";
      window.scrollTo(window.scrollX, window.scrollY);
      window.requestAnimationFrame(() => root.style.removeProperty("scroll-behavior"));
    }

    function cancelSmoothScrollFromKey(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLElement && target.matches("input, textarea, select, [contenteditable='true']")) return;
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) cancelSmoothScroll();
    }

    window.addEventListener("wheel", cancelSmoothScroll, { passive: true });
    window.addEventListener("touchstart", cancelSmoothScroll, { passive: true });
    window.addEventListener("keydown", cancelSmoothScrollFromKey);
    return () => {
      window.removeEventListener("wheel", cancelSmoothScroll);
      window.removeEventListener("touchstart", cancelSmoothScroll);
      window.removeEventListener("keydown", cancelSmoothScrollFromKey);
      if (copyResetTimer.current !== null) window.clearTimeout(copyResetTimer.current);
    };
  }, []);

  const selected = modes[guideMode];
  const practiceSelected = modes[practiceMode];
  const isCasualMode = practiceMode === "casual";
  const isMediaMode = practiceMode === "image" || practiceMode === "video";
  const supportsDesignBrief = practiceMode === "presentation" || practiceMode === "app";
  const referenceCoverage = useMemo(() => detectReferenceCoverage(referencePrompt), [referencePrompt]);
  const omittedReferenceFields = isMediaMode
    ? [referenceCoverage.visual ? practiceSelected.fields[1] : "", referenceCoverage.format ? practiceSelected.fields[2] : ""].filter(Boolean)
    : [];
  const practicePrompt = useMemo(() => buildPracticePrompt({
    mode: practiceMode,
    fields: practiceSelected.fields,
    objective,
    audience,
    tone,
    length,
    format,
    referencePrompt,
    designBrief,
    needsVerification,
  }), [practiceMode, practiceSelected.fields, objective, audience, tone, length, format, referencePrompt, designBrief, needsVerification]);

  async function copyPrompt() {
    if (copyResetTimer.current !== null) window.clearTimeout(copyResetTimer.current);
    try {
      await navigator.clipboard.writeText(practicePrompt);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
    copyResetTimer.current = window.setTimeout(() => {
      setCopyStatus("idle");
      copyResetTimer.current = null;
    }, copyFeedbackDuration);
  }

  function applyExample(mode: Mode, config: ModeConfig) {
    const casual = mode === "casual";
    setObjective(config.values[0]);
    setAudience(config.values[1]);
    setTone(casual ? config.values[2] : "");
    setLength(casual ? config.values[3] : "");
    setFormat(config.values[casual ? 4 : 2]);
  }

  function resetModeExtras() {
    setReferencePrompt("");
    setDesignBrief("");
    setDesignFileError("");
    setNeedsVerification(false);
    designReadId.current += 1;
    if (copyResetTimer.current !== null) window.clearTimeout(copyResetTimer.current);
    copyResetTimer.current = null;
    setCopyStatus("idle");
  }

  function loadExample() {
    applyExample(practiceMode, practiceSelected);
  }

  function startWithGuideExample() {
    setPracticeMode(guideMode);
    applyExample(guideMode, selected);
    resetModeExtras();
    window.requestAnimationFrame(() => document.getElementById("workbench")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function selectPracticeMode(nextMode: Mode) {
    if (nextMode === practiceMode) return;
    setPracticeMode(nextMode);
    setObjective("");
    setAudience("");
    setTone("");
    setLength("");
    setFormat("");
    resetModeExtras();
  }

  function readDesignFile(file: File | undefined) {
    if (!file) return;
    if (file.size > maxDesignFileBytes) {
      designReadId.current += 1;
      setDesignBrief("");
      setDesignFileError("design.md는 256KB 이하의 파일만 사용할 수 있습니다.");
      return;
    }
    setDesignFileError("");
    const readId = ++designReadId.current;
    const reader = new FileReader();
    reader.onload = () => {
      if (readId !== designReadId.current) return;
      setDesignBrief(String(reader.result ?? ""));
    };
    reader.onerror = () => {
      if (readId !== designReadId.current) return;
      setDesignBrief("");
      setDesignFileError("design.md를 읽지 못했습니다. 파일을 다시 선택해 주세요.");
    };
    reader.readAsText(file);
  }

  return (
    <main>
      <section className="hero" id="top">
        <nav className="site-nav" aria-label="주요 메뉴">
          <div className="nav-inner">
            <a className="brand" href="#top">prompt<span>author</span></a>
            <div className="nav-links">
              <a href="#paths">사용 방법</a>
              <a href="#modes">상황별 가이드</a>
              <a href="#practice">직접 만들기</a>
            </div>
          </div>
        </nav>
        <div className="hero-grid">
          <div>
            <p className="eyebrow">PROMPT AS A CONTRACT</p>
            <h1><span className="ai-accent">AI</span> 좋은 결과는 <em>좋은 조건</em>에서 시작됩니다.</h1>
            <p className="lede">Prompt Author는 막연한 요청을 목표·제약·검증이 담긴 바로 쓸 수 있는 프롬프트로 바꿉니다.</p>
            <a className="primary" href="#paths">두 가지 방법 보기 <span>→</span></a>
          </div>
        </div>
      </section>

      <section className="paths section" id="paths">
        <div className="paths-heading"><p className="section-kicker">01 / CHOOSE YOUR PATH</p><h2>원하는 방식으로 <em>바로 시작</em>하세요.</h2><p>지금 한 번의 프롬프트가 필요하면 웹에서 바로 생성하고, 특정 프롬프트를 만드는 상황이 반복되면 스킬을 설치하여 사용하세요.</p></div>
        <div className="path-cards">
          <article className="path-card web-path"><p className="mono">PATH 01</p><h3>웹에서 만들고 바로 붙여넣기</h3><p>조건을 입력해 프롬프트를 생성한 뒤 <strong>복사하기</strong>를 누르고, ChatGPT·Codex·Claude 등 원하는 곳에 붙여넣으세요.</p><div className="path-actions"><a href="#modes">요청 상황별 가이드 <span>→</span></a><a href="#workbench">웹에서 프롬프트 만들기 <span>→</span></a></div></article>
          <article className="path-card skill-path"><p className="mono">PATH 02</p><h3>스킬을 내려받아 Codex·Claude Code에서 사용하기</h3><p>저장소를 설치한 뒤 Codex에서는 <code>$prompt-author</code>, Claude Code에서는 <code>/prompt-author</code>로 상황에 맞는 프롬프트를 요청할 수 있습니다.</p><a href={`${repositoryUrl}#설치-방법`} target="_blank" rel="noreferrer">스킬 설치 방법 보기 <span>↗</span></a></article>
        </div>
      </section>

      <section className="mode-section section" id="modes">
        <div className="mode-header"><p className="section-kicker">02 / MODE SELECTOR</p><p>상황을 선택해 원칙과 예시를 확인하세요.</p></div>
        <div className="mode-layout">
          <div className="mode-list" role="tablist" aria-label="프롬프트 상황">
            {modeKeys.map((key, i) => <button type="button" key={key} className={guideMode === key ? "active" : ""} onClick={() => setGuideMode(key)} role="tab" aria-selected={guideMode === key}><span>{String(i + 1).padStart(2, "0")}</span><strong>{modes[key].label}</strong><small>{modes[key].short}</small><i>↗</i></button>)}
          </div>
          <article className="mode-detail">
            <p className="detail-tag">{selected.label.toUpperCase()} MODE</p>
            <h3>{selected.label} 프롬프트의 원칙</h3>
            <p className="detail-rule">{selected.rule}</p>
            <div className="needs"><p className="mono label">INCLUDE</p>{selected.fields.map((field) => <span key={field}>✓ {field}</span>)}</div>
            <div className="example"><p className="mono label">READY-TO-USE EXAMPLE</p><blockquote>{selected.example}</blockquote><button type="button" className="example-start" onClick={startWithGuideExample}>이 예시로 시작 <span>→</span></button></div>
          </article>
        </div>
      </section>


      <section className="practice section" id="practice">
        <div className="practice-heading"><p className="section-kicker">03 / TRY IT YOURSELF</p><h2>이제, 당신의 <em>조건을 넣어보세요.</em></h2><p>입력값이 비어 있으면 변수로 남습니다. 생성된 프롬프트는 <strong>복사하기</strong>를 눌러 ChatGPT·Codex·Claude 등 원하는 도구에 바로 붙여 넣을 수 있습니다.</p></div>
        <div className="workbench" id="workbench">
          <div className="form-panel">
            <div className="mode-choices" role="group" aria-label="상황">{modeKeys.map((key) => <button type="button" key={key} className={practiceMode === key ? "active" : ""} onClick={() => selectPracticeMode(key)}>{modes[key].label}</button>)}</div>
            <label>{practiceSelected.fields[0]}<textarea value={objective} onChange={(e) => setObjective(e.target.value)} placeholder={practiceSelected.placeholders[0]} rows={3} /></label>
            <label>{practiceSelected.fields[1]}<input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder={practiceSelected.placeholders[1]} /></label>
            {isCasualMode ? <><label>{practiceSelected.fields[2]}<input value={tone} onChange={(e) => setTone(e.target.value)} placeholder={practiceSelected.placeholders[2]} /></label><label>{practiceSelected.fields[3]}<input value={length} onChange={(e) => setLength(e.target.value)} placeholder={practiceSelected.placeholders[3]} /></label><label>{practiceSelected.fields[4]}<input value={format} onChange={(e) => setFormat(e.target.value)} placeholder={practiceSelected.placeholders[4]} /></label></> : <label>{practiceSelected.fields[2]}<input value={format} onChange={(e) => setFormat(e.target.value)} placeholder={practiceSelected.placeholders[2]} /></label>}
            {isCasualMode && <label className="verification-option"><input type="checkbox" checked={needsVerification} onChange={(e) => setNeedsVerification(e.target.checked)} />근거·불확실성 검증 포함</label>}
            {isMediaMode && <><p className="reference-help">레퍼런스가 필요하면 <a href="https://youmind.com/ko-KR/gpt-image-2-prompts/explore?categories=profile-avatar" target="_blank" rel="noreferrer">YouMind</a> 또는 <a href="https://prompts3.com/" target="_blank" rel="noreferrer">Prompts3</a>에서 마음에 드는 프롬프트를 찾아 복사해 붙여 넣으세요.</p><label>레퍼런스 프롬프트<textarea value={referencePrompt} onChange={(e) => setReferencePrompt(e.target.value)} placeholder="참고할 프롬프트를 붙여 넣으세요." rows={4} /></label>{omittedReferenceFields.length > 0 && <p className="file-status" role="status">레퍼런스에 {omittedReferenceFields.join(" · ")} 정보가 있어 생성 프롬프트에서 해당 입력을 제외했습니다.</p>}</>}
            {supportsDesignBrief && <><p className="reference-help"><a href="https://getdesign.md/" target="_blank" rel="noreferrer">getdesign.md</a>에서 디자인 기준을 찾거나, 가진 design.md 파일을 선택하세요. 내용은 이 브라우저에서만 읽습니다.</p><label>design.md 업로드<input type="file" accept=".md,text/markdown,text/plain" onChange={(e) => readDesignFile(e.target.files?.[0])} /></label>{designFileError ? <p className="file-status" role="alert">{designFileError}</p> : designBrief && <p className="file-status">design.md 디자인 설명을 {practiceMode === "app" ? "앱 UI 설계에" : "프롬프트에"} 반영합니다.</p>}</>}
            <button className="ghost" onClick={loadExample}>예시 조건 채우기 <span>↗</span></button>
          </div>
          <div className="output-panel"><div className="output-top"><span className="mono">YOUR PROMPT</span><button onClick={copyPrompt} aria-live="polite">{copyStatus === "copied" ? "복사됨!" : copyStatus === "error" ? "복사 실패" : "복사하기"}</button></div><pre>{practicePrompt}</pre><p className="output-note">{practiceMode === "goal" && practicePrompt.length > 4000 ? "Codex objective와 Claude Code condition은 4,000자 이내로 줄여야 합니다." : objective && audience && format && (practiceMode !== "casual" || (tone && length)) ? "조건이 모두 채워졌습니다. 이 프롬프트를 사용해 보세요." : "빈 조건은 {{변수}}로 남겨 두었습니다."}</p></div>
        </div>
      </section>

      <footer><a className="brand" href="#top">prompt<span>author</span></a><p>Write less. Specify better.</p><a href={repositoryUrl} target="_blank" rel="noreferrer">GitHub ↗</a></footer>
    </main>
  );
}
