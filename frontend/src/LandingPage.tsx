import { useEffect } from "react";
import { getLanguage, setLanguage, t, useLanguage } from "./i18n";
import logo from "./assets/app-logo.png";
import { LandingLogin } from "./LandingLogin";
import "./landing-styles.css";
import { brand } from "./shared/brand";

/** Landing copy comes from the legacy dictionary; "{app}" stands for the product name (ADR-0005). */
const lt = (text: string) => t(text).replaceAll("{app}", brand.name);

const screenshots = [
  { id: "topics", number: "01", title: "Выберите свою ситуацию", text: "Кафе, банк, врач или работа. Тренируйте фразы, которые пригодятся в обычной жизни.", alt: "{app}: выбор темы" },
  {
    id: "practice",
    number: "02",
    title: "Скажите это по-турецки",
    text: "Соберите фразу сами и произнесите вслух. Если слово забылось, воспользуйтесь подсказкой.",
    alt: "{app}: разговорная тренировка",
  },
  { id: "feedback", number: "03", title: "Разберите и повторите", text: "Посмотрите разбор ответа и вернитесь к фразам, которым нужно ещё немного практики.", alt: "{app}: разбор ответа" },
];

function AppLink({ compact = false }: { compact?: boolean }) {
  return (
    <a className={`landing-cta${compact ? " landing-cta--small" : ""}`} href="#sign-in">
      {lt(compact ? "Открыть приложение" : "Начать говорить")} <span aria-hidden="true">↗</span>
    </a>
  );
}

export function LandingPage() {
  const language = useLanguage();
  useEffect(() => {
    document.documentElement.lang = getLanguage();
    document.title = lt("{app} — начните говорить по-турецки");
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", lt("{app} — тренируйте разговорный турецкий на простых бытовых фразах. Для тех, кто уже знает слова и хочет начать говорить."));
  }, [language]);
  return (
    <div className="landing" id="top">
      <a className="landing-skip" href="#main">
        {lt("Перейти к содержанию")}
      </a>
      <header className="landing-header landing-wrap">
        <a href="#top" className="landing-brand" aria-label={brand.name}>
          <img src={logo} alt="" width="38" height="38" />
          <span>
            {brand.wordmark[0]}
            <span>{brand.wordmark[1]}</span>
            <small>{lt("Турецкий. Своими словами.")}</small>
          </span>
        </a>
        <nav aria-label={lt("Навигация по лендингу")}>
          <a href="#how">{lt("Как это работает")}</a>
        </nav>
        <div className="landing-languages" role="group" aria-label={lt("Язык страницы")}>
          <button type="button" lang="ru" aria-pressed={language === "ru"} onClick={() => setLanguage("ru")}>
            RU
          </button>
          <button type="button" lang="en" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>
            EN
          </button>
        </div>
        <AppLink compact />
      </header>
      <main id="main">
        <section className="landing-hero">
          <img
            className="landing-hero-art"
            src="/landing/hero.webp"
            alt={lt("Стакан турецкого чая и симит на палубе парома, за бортом Босфор и Стамбул")}
            width="2200"
            height="1245"
            fetchPriority="high"
          />
          <div className="landing-hero-copy landing-wrap">
            <p className="landing-eyebrow">
              <span />
              {lt("ОТ ЗНАКОМЫХ СЛОВ — К ЖИВОЙ РЕЧИ")}
            </p>
            <h1>
              {lt("Вы уже знаете слова.")}
              <br />
              <span>{lt("Пора заговорить.")}</span>
            </h1>
            <p className="landing-lead">{lt("Турецкий для повседневной жизни. Простые фразы, ваш голос и практика, которая помогает словам складываться в речь.")}</p>
            <div className="landing-actions">
              <AppLink />
            </div>
            <p className="landing-hero-note">{lt("Для уровня A2 · В браузере")}</p>
            <a className="landing-explore" href="#how">
              {lt("Заглянуть внутрь")} <span aria-hidden="true">↓</span>
            </a>
          </div>
        </section>
        <section id="how" className="landing-how landing-wrap">
          <div className="landing-section-heading">
            <div>
              <p className="landing-eyebrow">{lt("МЕНЬШЕ ТЕОРИИ. БОЛЬШЕ ВАШЕГО ГОЛОСА.")}</p>
              <h2>
                {lt("Ваш следующий разговор")}
                <br />
                <em>{lt("начинается здесь.")}</em>
              </h2>
            </div>
            <p>{lt("Одна бытовая ситуация. Одна фраза за другой. Практика в вашем темпе.")}</p>
          </div>
          <div className="landing-steps">
            {screenshots.map(item => (
              <article key={item.id}>
                <div className="landing-step-title">
                  <span>{item.number}</span>
                  <h3>{lt(item.title)}</h3>
                </div>
                <p>{lt(item.text)}</p>
                <div className="landing-phone">
                  <img src={`/landing/screens/phone/${language}-${item.id}.jpg`} alt={lt(item.alt)} width="1280" height="2772" loading="lazy" />
                </div>
              </article>
            ))}
          </div>
        </section>
        <section id="get-app" className="landing-bottom landing-wrap">
          <span className="landing-eyebrow">{lt("НЕБОЛЬШАЯ ПРАКТИКА. НАСТОЯЩИЙ РАЗГОВОР.")}</span>
          <h2>
            {lt("Дайте словам")} <em>{lt("свой голос.")}</em>
          </h2>
          <p>{lt("Начните с простой фразы. Например, с кофе.")}</p>
          <LandingLogin />
        </section>
      </main>
      <footer className="landing-footer landing-wrap">
        <a className="landing-brand" href="#top">
          {brand.wordmark[0]}
          <span>{brand.wordmark[1]}</span>
        </a>
        <span>{lt("Турецкий. Своими словами.")}</span>
        <div>
          <a href="/privacy" target="_blank" rel="noopener noreferrer">
            {lt("Конфиденциальность")}
          </a>
          <a href="/terms" target="_blank" rel="noopener noreferrer">
            {lt("Условия использования")}
          </a>
        </div>
      </footer>
    </div>
  );
}
