import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  CalendarDays,
  Check,
  ChevronRight,
  FileText,
  FolderKanban,
  Menu,
  MessageSquareText,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
} from 'lucide-react';
import { isAuthenticated, getAuthData } from '../utils/auth.jsx';
import NavigationBar from '../components/NavigationBar';
import ChatSidebar from '../components/ChatSidebar';
import AllyConsultationChat from '../components/AllyConsultationChat';
import { useSidebar } from '../contexts/SidebarContext';
import './LandingPage.css';

const platformFeatures = [
  {
    icon: Bot,
    eyebrow: 'Legal research, made conversational',
    title: 'Ask the question in your own words.',
    description:
      'ALLY uses retrieval-augmented generation to find relevant Philippine Supreme Court case context and turn it into a clearer starting point.',
    className: 'feature-card--ai',
  },
  {
    icon: FolderKanban,
    eyebrow: 'One case, one organized space',
    title: 'Keep the moving pieces together.',
    description:
      'Track case status, notes, hearings, documents, and AI conversations from one focused legal workspace.',
    className: 'feature-card--workspace',
  },
  {
    icon: UsersRound,
    eyebrow: 'Human help when it matters',
    title: 'Move from information to counsel.',
    description:
      'Find lawyers, manage consultations, and keep client–lawyer communication connected to the case at hand.',
    className: 'feature-card--people',
  },
];

const journeySteps = [
  {
    number: '01',
    title: 'Tell ALLY what is happening',
    description: 'Start with a plain-language question or create a case when you are ready to take action.',
  },
  {
    number: '02',
    title: 'Build a clearer picture',
    description: 'Review AI-supported legal context, organize documents, and keep every important detail in one place.',
  },
  {
    number: '03',
    title: 'Work with the right people',
    description: 'Connect with a lawyer and manage the work ahead—from consultations to hearings and case updates.',
  },
];

const LandingPage = () => {
  const navigate = useNavigate();
  const isLoggedIn = isAuthenticated();
  const authData = getAuthData();
  const userRole = authData?.role || null;
  const { isExpanded } = useSidebar();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ChatSidebar userRole={userRole} />
        <div className={`transition-all duration-300 ${isExpanded ? 'ml-[240px]' : 'ml-[60px]'}`}>
          <NavigationBar />
          <main className="pt-16 h-[calc(100vh-4rem)]">
            <AllyConsultationChat />
          </main>
        </div>
      </div>
    );
  }

  const goToSignup = () => navigate('/signup');
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <div className="ally-landing">
      <header className="landing-nav">
        <div className="landing-shell landing-nav__inner">
          <button className="landing-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="ALLY home">
            <img src="/ally_logo.svg" alt="ALLY" />
          </button>

          <nav className="landing-nav__links" aria-label="Primary navigation">
            <a href="#platform">Platform</a>
            <a href="#how-it-works">How it works</a>
            <a href="#why-ally">Why ALLY</a>
          </nav>

          <div className="landing-nav__actions">
            <button className="button button--text" onClick={() => navigate('/login')}>Log in</button>
            <button className="button button--dark button--small" onClick={goToSignup}>
              Get started <ArrowRight size={16} />
            </button>
          </div>

          <button
            className="landing-nav__menu"
            aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="landing-mobile-menu">
            <a href="#platform" onClick={closeMenu}>Platform</a>
            <a href="#how-it-works" onClick={closeMenu}>How it works</a>
            <a href="#why-ally" onClick={closeMenu}>Why ALLY</a>
            <button onClick={() => navigate('/login')}>Log in</button>
            <button className="button button--dark" onClick={goToSignup}>Get started</button>
          </div>
        )}
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero__glow landing-hero__glow--one" />
          <div className="landing-hero__glow landing-hero__glow--two" />
          <div className="landing-shell landing-hero__grid">
            <div className="landing-hero__copy">
              <div className="eyebrow-pill">
                <Sparkles size={15} />
                Your digital legal ally
              </div>
              <h1>Legal help should feel <em>less intimidating.</em></h1>
              <p className="landing-hero__lead">
                Understand your options, organize your case, and work with legal professionals—all in one thoughtful platform built for the Philippine legal journey.
              </p>
              <div className="landing-hero__actions">
                <button className="button button--primary" onClick={goToSignup}>
                  Start with ALLY <ArrowRight size={18} />
                </button>
                <a className="button button--ghost" href="#platform">
                  Explore the platform <ChevronRight size={18} />
                </a>
              </div>
              <div className="landing-hero__reassurance">
                <span><Check size={15} /> AI-supported legal research</span>
                <span><Check size={15} /> Case-centered workspace</span>
              </div>
            </div>

            <div className="product-preview" aria-label="Preview of the ALLY legal workspace">
              <div className="product-preview__halo" />
              <div className="product-window">
                <div className="product-window__topbar">
                  <div className="product-window__brand">
                    <img src="/logo_notext.svg" alt="" />
                    <span>ALLY Workspace</span>
                  </div>
                  <div className="product-window__profile">JM</div>
                </div>
                <div className="product-window__body">
                  <aside className="product-sidebar">
                    <div className="product-sidebar__active"><MessageSquareText size={16} /> Ask ALLY</div>
                    <div><FolderKanban size={16} /> My cases</div>
                    <div><FileText size={16} /> Documents</div>
                    <div><CalendarDays size={16} /> Hearings</div>
                  </aside>
                  <div className="product-chat">
                    <div className="product-chat__heading">
                      <span>Legal research assistant</span>
                      <small><span className="status-dot" /> Ready</small>
                    </div>
                    <div className="chat-bubble chat-bubble--user">
                      What should I prepare before meeting a lawyer about a contract dispute?
                    </div>
                    <div className="chat-response">
                      <div className="chat-response__icon"><Bot size={17} /></div>
                      <div>
                        <strong>Let’s make that easier to prepare for.</strong>
                        <p>Start by gathering the signed contract, related messages, proof of payment, and a short timeline of what happened.</p>
                        <div className="source-chip"><Search size={13} /> Review relevant case context</div>
                      </div>
                    </div>
                    <div className="product-chat__input">
                      <span>Ask a follow-up question...</span>
                      <button aria-label="Send preview message"><ArrowRight size={15} /></button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="floating-card floating-card--case">
                <span className="floating-card__icon"><FolderKanban size={17} /></span>
                <span><small>Case workspace</small><strong>Everything, organized</strong></span>
                <Check size={16} />
              </div>
              <div className="floating-card floating-card--secure">
                <ShieldCheck size={18} />
                <span><strong>Built for privacy</strong><small>Your case stays yours</small></span>
              </div>
            </div>
          </div>
        </section>

        <section className="clarity-strip" aria-label="ALLY platform overview">
          <div className="landing-shell clarity-strip__inner">
            <p>One platform, from first question to next step.</p>
            <div className="clarity-strip__items">
              <span><Bot size={18} /> Ask</span><i />
              <span><Search size={18} /> Understand</span><i />
              <span><FolderKanban size={18} /> Organize</span><i />
              <span><UsersRound size={18} /> Collaborate</span>
            </div>
          </div>
        </section>

        <section className="landing-section platform-section" id="platform">
          <div className="landing-shell">
            <div className="section-heading section-heading--split">
              <div>
                <span className="section-kicker">The ALLY platform</span>
                <h2>Designed around the whole legal journey.</h2>
              </div>
              <p>
                Legal matters rarely live in a single chat or file. ALLY brings research, casework, documents, schedules, and people into one connected experience.
              </p>
            </div>

            <div className="feature-grid">
              {platformFeatures.map(({ icon: Icon, eyebrow, title, description, className }) => (
                <article className={`feature-card ${className}`} key={title}>
                  <div className="feature-card__icon"><Icon size={22} /></div>
                  <span className="feature-card__eyebrow">{eyebrow}</span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                  <div className="feature-card__visual" aria-hidden="true">
                    {className === 'feature-card--ai' && (
                      <>
                        <div className="mini-question">Can you explain this in plain language?</div>
                        <div className="mini-answer"><Sparkles size={15} /> Here’s a clearer way to think about it...</div>
                      </>
                    )}
                    {className === 'feature-card--workspace' && (
                      <>
                        <div className="workspace-row"><FileText size={15} /><span>Contract and evidence</span><small>8 files</small></div>
                        <div className="workspace-row"><CalendarDays size={15} /><span>Next hearing</span><small>Scheduled</small></div>
                        <div className="workspace-row"><MessageSquareText size={15} /><span>Case notes</span><small>Updated</small></div>
                      </>
                    )}
                    {className === 'feature-card--people' && (
                      <div className="people-stack">
                        <span>AL</span><span>MR</span><span>JC</span>
                        <div><strong>Connected to your case</strong><small>Client · Lawyer · ALLY</small></div>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section journey-section" id="how-it-works">
          <div className="landing-shell journey-grid">
            <div className="journey-intro">
              <span className="section-kicker section-kicker--light">How it works</span>
              <h2>From “where do I start?” to a clearer way forward.</h2>
              <p>
                ALLY helps you make progress at your own pace—whether you need a first layer of context or a shared space for active casework.
              </p>
              <button className="button button--light" onClick={goToSignup}>Create your account <ArrowRight size={17} /></button>
            </div>
            <div className="journey-steps">
              {journeySteps.map((step) => (
                <article className="journey-step" key={step.number}>
                  <span className="journey-step__number">{step.number}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section trust-section" id="why-ally">
          <div className="landing-shell trust-grid">
            <div className="trust-visual">
              <div className="trust-visual__orbit trust-visual__orbit--outer" />
              <div className="trust-visual__orbit trust-visual__orbit--inner" />
              <div className="trust-visual__center">
                <Scale size={34} />
                <strong>Clarity with context</strong>
                <small>Technology supporting—not replacing—legal judgment</small>
              </div>
              <div className="orbit-label orbit-label--one"><Bot size={16} /> AI support</div>
              <div className="orbit-label orbit-label--two"><ShieldCheck size={16} /> Privacy</div>
              <div className="orbit-label orbit-label--three"><UsersRound size={16} /> Human counsel</div>
            </div>
            <div className="trust-copy">
              <span className="section-kicker">Why ALLY</span>
              <h2>Technology that helps you arrive more prepared.</h2>
              <p>
                ALLY turns scattered legal work into a more understandable process. It gives clients a better starting point and gives lawyers a more organized place to work with them.
              </p>
              <ul>
                <li><Check size={16} /> Research grounded in retrieved Philippine case context</li>
                <li><Check size={16} /> Access controls centered on case participants</li>
                <li><Check size={16} /> A clear distinction between legal information and legal advice</li>
              </ul>
              <div className="trust-note">
                <ShieldCheck size={20} />
                <p><strong>A responsible starting point.</strong> ALLY provides legal information and workflow support. Specific legal advice should come from a licensed Philippine lawyer.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-cta">
          <div className="landing-shell landing-cta__card">
            <div className="landing-cta__mark"><img src="/logo_notext.svg" alt="" /></div>
            <span className="section-kicker section-kicker--light">A clearer next step starts here</span>
            <h2>Whatever brought you here, you don’t have to sort it out alone.</h2>
            <p>Begin with a question. Build the case from there.</p>
            <div className="landing-cta__actions">
              <button className="button button--light button--large" onClick={goToSignup}>Get started with ALLY <ArrowRight size={18} /></button>
              <button className="button button--outline-light button--large" onClick={() => navigate('/login')}>I already have an account</button>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-shell landing-footer__top">
          <div className="landing-footer__brand">
            <img src="/ally_logo.svg" alt="ALLY" />
            <p>Your digital legal engagement platform.</p>
          </div>
          <div className="landing-footer__links">
            <div><strong>Explore</strong><a href="#platform">Platform</a><a href="#how-it-works">How it works</a><a href="#why-ally">Why ALLY</a></div>
            <div><strong>Account</strong><button onClick={() => navigate('/login')}>Log in</button><button onClick={goToSignup}>Create account</button></div>
          </div>
        </div>
        <div className="landing-shell landing-footer__bottom">
          <span>© 2026 ALLY Development Team</span>
          <span>Legal information, not legal advice.</span>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
