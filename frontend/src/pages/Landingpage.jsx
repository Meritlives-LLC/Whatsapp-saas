import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const FEATURES = [
  {
    icon: '🤖',
    title: 'AI Replies Instantly',
    desc: 'DeepSeek AI answers your customers 24/7 — even while you sleep. No missed sales.',
  },
  {
    icon: '💳',
    title: 'Collect Payments in Chat',
    desc: 'Generate Paystack payment links right inside WhatsApp. Card, bank transfer, USSD.',
  },
  {
    icon: '📅',
    title: 'Book Appointments',
    desc: 'Customers book services directly in the chat. No back-and-forth, no lost bookings.',
  },
  {
    icon: '📊',
    title: 'Live Analytics',
    desc: 'See every conversation, lead, and payment in one dashboard. Know what\'s working.',
  },
  {
    icon: '🎯',
    title: 'Lead Capture',
    desc: 'AI automatically tags and saves leads from conversations. Never lose a prospect again.',
  },
  {
    icon: '⚡',
    title: 'Zero Setup Friction',
    desc: 'Connect WhatsApp in one click via Facebook Login. AI is live in under 5 minutes.',
  },
];

const PLANS = [
  {
    name: 'Free',
    price: '₦0',
    period: 'forever',
    color: '#6b7280',
    features: ['30 AI replies/month', '1 WhatsApp number', '5 products', 'Basic analytics'],
    cta: 'Start Free',
    highlight: false,
  },
  {
    name: 'Starter',
    price: '₦8,000',
    period: '/month',
    color: '#3b82f6',
    features: ['1,000 AI replies/month', '1 WhatsApp number', '50 products', 'Bookings & payments', 'Lead capture'],
    cta: 'Get Starter',
    highlight: false,
  },
  {
    name: 'Growth',
    price: '₦20,000',
    period: '/month',
    color: '#22c55e',
    features: ['5,000 AI replies/month', '3 WhatsApp numbers', 'Unlimited products', 'Priority support', 'Custom AI persona'],
    cta: 'Get Growth',
    highlight: true,
    badge: 'Most Popular',
  },
  {
    name: 'Pro',
    price: '₦45,000',
    period: '/month',
    color: '#a855f7',
    features: ['Unlimited AI replies', '10 WhatsApp numbers', 'White-label dashboard', 'Dedicated support', 'SLA guarantee'],
    cta: 'Get Pro',
    highlight: false,
  },
];

const STATS = [
  { value: '95%', label: 'of Nigerians use WhatsApp daily' },
  { value: '98%', label: 'WhatsApp message open rate' },
  { value: '24/7', label: 'AI replies without breaks' },
  { value: '5 min', label: 'to get fully set up' },
];

const TESTIMONIALS = [
  {
    name: 'Amaka O.',
    business: 'Amaka\'s Boutique, Lagos',
    text: 'I used to miss customers when I was busy. Now the AI handles everything and sends payment links. My sales went up 40% in one month.',
    avatar: 'A',
    color: '#22c55e',
  },
  {
    name: 'Emeka D.',
    business: 'Emeka Foods, Abuja',
    text: 'My customers ask about my menu, place orders, and pay — all on WhatsApp. I just cook and deliver. This thing is magic.',
    avatar: 'E',
    color: '#3b82f6',
  },
  {
    name: 'Funke A.',
    business: 'Funke\'s Salon, Port Harcourt',
    text: 'Bookings used to be chaos on WhatsApp. Now the AI collects name, date, time automatically. I just confirm. Game changer.',
    avatar: 'F',
    color: '#a855f7',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const heroRef = useRef(null);
  const [scrollY, setScrollY] = useState(0);
  const [visibleSections, setVisibleSections] = useState(new Set());

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setVisibleSections(prev => new Set([...prev, entry.target.dataset.section]));
          }
        });
      },
      { threshold: 0.15 }
    );
    document.querySelectorAll('[data-section]').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const isVisible = (section) => visibleSections.has(section);

  return (
    <div style={{ fontFamily: "'DM Sans', 'Outfit', sans-serif", background: '#0a0a0a', color: '#fff', overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,700;0,9..40,900;1,9..40,400&family=Bebas+Neue&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .fade-up {
          opacity: 0;
          transform: translateY(40px);
          transition: opacity 0.7s ease, transform 0.7s ease;
        }
        .fade-up.visible {
          opacity: 1;
          transform: translateY(0);
        }
        .fade-up-delay-1 { transition-delay: 0.1s; }
        .fade-up-delay-2 { transition-delay: 0.2s; }
        .fade-up-delay-3 { transition-delay: 0.3s; }
        .fade-up-delay-4 { transition-delay: 0.4s; }
        .fade-up-delay-5 { transition-delay: 0.5s; }
        .fade-up-delay-6 { transition-delay: 0.6s; }

        .glow-green {
          box-shadow: 0 0 40px rgba(34, 197, 94, 0.3);
        }
        .glow-green:hover {
          box-shadow: 0 0 60px rgba(34, 197, 94, 0.5);
          transform: translateY(-2px);
        }

        .noise::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
          pointer-events: none;
          z-index: 999;
          opacity: 0.4;
        }

        .chat-bubble {
          animation: floatBubble 3s ease-in-out infinite;
        }
        .chat-bubble:nth-child(2) { animation-delay: 0.5s; }
        .chat-bubble:nth-child(3) { animation-delay: 1s; }

        @keyframes floatBubble {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }

        .typing-dot {
          animation: typingDot 1.4s infinite;
          border-radius: 50%;
          background: #22c55e;
          width: 6px; height: 6px;
        }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typingDot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }

        .grid-bg {
          background-image:
            linear-gradient(rgba(34,197,94,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34,197,94,0.03) 1px, transparent 1px);
          background-size: 60px 60px;
        }

        .plan-card {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .plan-card:hover {
          transform: translateY(-8px);
        }

        .feature-card {
          transition: all 0.3s ease;
          border: 1px solid rgba(255,255,255,0.06);
        }
        .feature-card:hover {
          border-color: rgba(34,197,94,0.3);
          background: rgba(34,197,94,0.04) !important;
        }

        .nav-link {
          color: rgba(255,255,255,0.6);
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: color 0.2s;
          cursor: pointer;
        }
        .nav-link:hover { color: #fff; }

        .ticker {
          animation: ticker 20s linear infinite;
          white-space: nowrap;
        }
        @keyframes ticker {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }

        @media (max-width: 768px) {
          .hero-title { font-size: clamp(48px, 12vw, 80px) !important; }
          .hero-subtitle { font-size: 16px !important; }
          .plans-grid { grid-template-columns: 1fr !important; }
          .features-grid { grid-template-columns: 1fr !important; }
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .testimonials-grid { grid-template-columns: 1fr !important; }
          .nav-links { display: none !important; }
          .hero-visual { display: none !important; }
          .hero-inner { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className="noise" />

      {/* ── NAV ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '16px 32px',
        background: scrollY > 50 ? 'rgba(10,10,10,0.9)' : 'transparent',
        backdropFilter: scrollY > 50 ? 'blur(20px)' : 'none',
        borderBottom: scrollY > 50 ? '1px solid rgba(255,255,255,0.06)' : 'none',
        transition: 'all 0.3s ease',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, background: '#22c55e', borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>⚡</div>
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.3px' }}>WA AutoBot</span>
        </div>

        <div className="nav-links" style={{ display: 'flex', gap: 32 }}>
          {['Features', 'Pricing', 'Testimonials'].map(item => (
            <span key={item} className="nav-link"
              onClick={() => document.getElementById(item.toLowerCase())?.scrollIntoView({ behavior: 'smooth' })}>
              {item}
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => navigate('/login')}
            style={{
              background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff', borderRadius: 10, padding: '8px 18px',
              fontSize: 14, fontWeight: 500, cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.target.style.borderColor = 'rgba(255,255,255,0.4)'}
            onMouseLeave={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
          >
            Login
          </button>
          <button onClick={() => navigate('/login')}
            style={{
              background: '#22c55e', border: 'none', color: '#000',
              borderRadius: 10, padding: '8px 18px', fontSize: 14,
              fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.target.style.background = '#16a34a'}
            onMouseLeave={e => e.target.style.background = '#22c55e'}
          >
            Get Started →
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section ref={heroRef} className="grid-bg" style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        padding: '120px 32px 80px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Radial glow */}
        <div style={{
          position: 'absolute', top: '30%', left: '20%',
          width: 600, height: 600,
          background: 'radial-gradient(circle, rgba(34,197,94,0.12) 0%, transparent 70%)',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }} />

        <div className="hero-inner" style={{
          maxWidth: 1200, margin: '0 auto', width: '100%',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80,
          alignItems: 'center',
        }}>
          {/* Left */}
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: 100, padding: '6px 14px', marginBottom: 32,
              fontSize: 13, color: '#22c55e', fontWeight: 500,
            }}>
              <span style={{ width: 6, height: 6, background: '#22c55e', borderRadius: '50%', display: 'inline-block' }} />
              Now live in Nigeria 🇳🇬
            </div>

            <h1 className="hero-title" style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 'clamp(64px, 8vw, 110px)',
              lineHeight: 0.95, letterSpacing: '-1px',
              marginBottom: 28,
            }}>
              YOUR WHATSAPP<br />
              <span style={{ color: '#22c55e' }}>SELLS FOR YOU</span><br />
              ALL DAY LONG
            </h1>

            <p className="hero-subtitle" style={{
              fontSize: 18, color: 'rgba(255,255,255,0.55)',
              lineHeight: 1.7, marginBottom: 40, maxWidth: 480,
            }}>
              AI-powered WhatsApp assistant that replies customers, books appointments,
              and collects Paystack payments — automatically. While you focus on your business.
            </p>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <button onClick={() => navigate('/login')}
                className="glow-green"
                style={{
                  background: '#22c55e', color: '#000', border: 'none',
                  borderRadius: 14, padding: '16px 32px', fontSize: 16,
                  fontWeight: 700, cursor: 'pointer', transition: 'all 0.3s',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                Start Free — No Card Needed 🚀
              </button>
              <button
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                style={{
                  background: 'transparent', color: '#fff',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 14, padding: '16px 28px', fontSize: 16,
                  fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s',
                }}
                onMouseEnter={e => e.target.style.borderColor = 'rgba(255,255,255,0.4)'}
                onMouseLeave={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
              >
                See how it works ↓
              </button>
            </div>

            <p style={{ marginTop: 20, fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
              ✓ Free forever plan &nbsp;&nbsp; ✓ Setup in 5 minutes &nbsp;&nbsp; ✓ No credit card
            </p>
          </div>

          {/* Right — WhatsApp chat mockup */}
          <div className="hero-visual" style={{ position: 'relative' }}>
            <div style={{
              background: '#111', borderRadius: 24, overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
            }}>
              {/* WA header */}
              <div style={{
                background: '#1a1a1a', padding: '16px 20px',
                display: 'flex', alignItems: 'center', gap: 12,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{
                  width: 40, height: 40, background: '#22c55e',
                  borderRadius: '50%', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 18,
                }}>🏪</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>Amaka's Boutique</div>
                  <div style={{ fontSize: 12, color: '#22c55e' }}>● Online · AI Active</div>
                </div>
              </div>

              {/* Messages */}
              <div style={{ padding: 20, background: '#0d1117', minHeight: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Incoming */}
                <div className="chat-bubble" style={{ alignSelf: 'flex-start', maxWidth: '75%' }}>
                  <div style={{
                    background: '#1e1e1e', borderRadius: '16px 16px 16px 4px',
                    padding: '10px 14px', fontSize: 14, color: 'rgba(255,255,255,0.85)',
                  }}>
                    Hello! Do you have the red ankara gown in size 14?
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4, marginLeft: 4 }}>10:32 AM</div>
                </div>

                {/* AI reply */}
                <div className="chat-bubble" style={{ alignSelf: 'flex-end', maxWidth: '78%' }}>
                  <div style={{
                    background: '#22c55e', borderRadius: '16px 16px 4px 16px',
                    padding: '10px 14px', fontSize: 14, color: '#000', fontWeight: 500,
                  }}>
                    Yes! 🎉 We have the Red Ankara Gown in sizes 12, 14 & 16. It's ₦15,500. Would you like to pay now or schedule a fitting?
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4, textAlign: 'right', marginRight: 4 }}>
                    10:32 AM · 🤖 AI
                  </div>
                </div>

                {/* Incoming */}
                <div className="chat-bubble" style={{ alignSelf: 'flex-start', maxWidth: '70%' }}>
                  <div style={{
                    background: '#1e1e1e', borderRadius: '16px 16px 16px 4px',
                    padding: '10px 14px', fontSize: 14, color: 'rgba(255,255,255,0.85)',
                  }}>
                    I want to pay now please!
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4, marginLeft: 4 }}>10:33 AM</div>
                </div>

                {/* AI sends payment link */}
                <div className="chat-bubble" style={{ alignSelf: 'flex-end', maxWidth: '80%' }}>
                  <div style={{
                    background: '#22c55e', borderRadius: '16px 16px 4px 16px',
                    padding: '10px 14px', fontSize: 14, color: '#000', fontWeight: 500,
                  }}>
                    Perfect! Here's your payment link 👇<br />
                    <span style={{
                      display: 'inline-block', marginTop: 8,
                      background: 'rgba(0,0,0,0.15)', borderRadius: 8,
                      padding: '6px 12px', fontSize: 12, fontFamily: 'monospace',
                    }}>
                      pay.paystack.com/WA-17234...
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4, textAlign: 'right', marginRight: 4 }}>
                    10:33 AM · 🤖 AI
                  </div>
                </div>

                {/* Typing indicator */}
                <div style={{ alignSelf: 'flex-start' }}>
                  <div style={{
                    background: '#1e1e1e', borderRadius: '16px 16px 16px 4px',
                    padding: '12px 16px', display: 'flex', gap: 4, alignItems: 'center',
                  }}>
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                  </div>
                </div>
              </div>
            </div>

            {/* Floating badge */}
            <div style={{
              position: 'absolute', top: -16, right: -16,
              background: '#22c55e', color: '#000',
              borderRadius: 12, padding: '10px 16px',
              fontSize: 13, fontWeight: 700,
              boxShadow: '0 8px 32px rgba(34,197,94,0.4)',
            }}>
              ⚡ Replied in 0.8s
            </div>

            <div style={{
              position: 'absolute', bottom: -16, left: -16,
              background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12, padding: '10px 16px',
              fontSize: 13, fontWeight: 600, color: '#fff',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}>
              💰 Payment sent — ₦15,500
            </div>
          </div>
        </div>
      </section>

      {/* ── TICKER ── */}
      <div style={{
        background: '#22c55e', padding: '14px 0', overflow: 'hidden',
        borderTop: '1px solid rgba(0,0,0,0.1)',
      }}>
        <div className="ticker" style={{ display: 'flex', gap: 48 }}>
          {Array(6).fill(['🤖 AI Replies 24/7', '💳 Paystack Payments', '📅 Auto Bookings', '📊 Live Analytics', '🇳🇬 Built for Nigeria', '⚡ Setup in 5 Minutes']).flat().map((item, i) => (
            <span key={i} style={{ color: '#000', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{item}</span>
          ))}
        </div>
      </div>

      {/* ── STATS ── */}
      <section style={{ padding: '80px 32px', background: '#0d0d0d' }}>
        <div className="stats-grid" data-section="stats"
          style={{
            maxWidth: 900, margin: '0 auto',
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32,
          }}>
          {STATS.map((s, i) => (
            <div key={i}
              className={`fade-up fade-up-delay-${i + 1} ${isVisible('stats') ? 'visible' : ''}`}
              style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 56, color: '#22c55e', lineHeight: 1,
              }}>{s.value}</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginTop: 8, lineHeight: 1.5 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ padding: '100px 32px', background: '#0a0a0a' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div data-section="features-header" style={{ textAlign: 'center', marginBottom: 64 }}>
            <p className={`fade-up ${isVisible('features-header') ? 'visible' : ''}`}
              style={{ color: '#22c55e', fontWeight: 600, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>
              Everything you need
            </p>
            <h2 className={`fade-up fade-up-delay-1 ${isVisible('features-header') ? 'visible' : ''}`}
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 'clamp(42px, 6vw, 72px)', lineHeight: 1,
              }}>
              ONE TOOL.<br />
              <span style={{ color: '#22c55e' }}>INFINITE POSSIBILITIES.</span>
            </h2>
          </div>

          <div className="features-grid" data-section="features"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {FEATURES.map((f, i) => (
              <div key={i}
                className={`feature-card fade-up fade-up-delay-${(i % 3) + 1} ${isVisible('features') ? 'visible' : ''}`}
                style={{
                  background: 'rgba(255,255,255,0.02)', borderRadius: 20,
                  padding: 28,
                }}>
                <div style={{ fontSize: 32, marginBottom: 16 }}>{f.icon}</div>
                <h3 style={{ fontWeight: 700, fontSize: 17, marginBottom: 10 }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ padding: '100px 32px', background: '#0d0d0d' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ color: '#22c55e', fontWeight: 600, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>
            Simple process
          </p>
          <h2 data-section="how" style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 'clamp(42px, 6vw, 72px)', lineHeight: 1, marginBottom: 64,
          }}>
            UP AND RUNNING<br /><span style={{ color: '#22c55e' }}>IN 5 MINUTES</span>
          </h2>

          <div data-section="steps" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { n: '01', title: 'Create your account', desc: 'Sign up free. No credit card needed. Takes 30 seconds.' },
              { n: '02', title: 'Connect WhatsApp', desc: 'Click "Continue with Facebook" and grant access. One button, done.' },
              { n: '03', title: 'Add your business info', desc: 'Tell the AI about your products, prices, and policies. The more you add, the smarter it gets.' },
              { n: '04', title: 'Go live', desc: 'Send a message to your number. The AI replies instantly. Your business now works 24/7.' },
            ].map((step, i) => (
              <div key={i}
                className={`fade-up fade-up-delay-${i + 1} ${isVisible('steps') ? 'visible' : ''}`}
                style={{
                  display: 'flex', gap: 32, alignItems: 'flex-start',
                  padding: '32px 0',
                  borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  textAlign: 'left',
                }}>
                <div style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 48, color: '#22c55e', opacity: 0.4,
                  lineHeight: 1, flexShrink: 0, width: 60,
                }}>{step.n}</div>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>{step.title}</h3>
                  <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{ padding: '100px 32px', background: '#0a0a0a' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <p style={{ color: '#22c55e', fontWeight: 600, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>
              Transparent pricing
            </p>
            <h2 style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 'clamp(42px, 6vw, 72px)', lineHeight: 1,
            }}>
              PLANS FOR EVERY<br /><span style={{ color: '#22c55e' }}>BUSINESS SIZE</span>
            </h2>
          </div>

          <div className="plans-grid" data-section="pricing"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
            {PLANS.map((plan, i) => (
              <div key={i}
                className={`plan-card fade-up fade-up-delay-${i + 1} ${isVisible('pricing') ? 'visible' : ''}`}
                style={{
                  background: plan.highlight ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.02)',
                  border: plan.highlight ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 20, padding: 28, position: 'relative',
                }}>
                {plan.badge && (
                  <div style={{
                    position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                    background: '#22c55e', color: '#000', borderRadius: 100,
                    padding: '4px 14px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
                  }}>{plan.badge}</div>
                )}
                <div style={{ marginBottom: 20 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: plan.color + '22', marginBottom: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18,
                  }}>
                    {plan.name === 'Free' ? '🆓' : plan.name === 'Starter' ? '🚀' : plan.name === 'Growth' ? '📈' : '👑'}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>{plan.name}</div>
                  <div>
                    <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, color: plan.highlight ? '#22c55e' : '#fff' }}>
                      {plan.price}
                    </span>
                    <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>{plan.period}</span>
                  </div>
                </div>

                <ul style={{ listStyle: 'none', marginBottom: 28 }}>
                  {plan.features.map((f, j) => (
                    <li key={j} style={{
                      fontSize: 13, color: 'rgba(255,255,255,0.6)',
                      padding: '7px 0',
                      borderBottom: j < plan.features.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      display: 'flex', gap: 8, alignItems: 'center',
                    }}>
                      <span style={{ color: plan.color, flexShrink: 0 }}>✓</span> {f}
                    </li>
                  ))}
                </ul>

                <button onClick={() => navigate('/login')}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 12, border: 'none',
                    background: plan.highlight ? '#22c55e' : 'rgba(255,255,255,0.08)',
                    color: plan.highlight ? '#000' : '#fff',
                    fontWeight: 700, fontSize: 14, cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  {plan.cta} →
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section id="testimonials" style={{ padding: '100px 32px', background: '#0d0d0d' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <p style={{ color: '#22c55e', fontWeight: 600, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>
              Real businesses. Real results.
            </p>
            <h2 style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 'clamp(42px, 6vw, 72px)', lineHeight: 1,
            }}>
              NIGERIANS ARE<br /><span style={{ color: '#22c55e' }}>ALREADY WINNING</span>
            </h2>
          </div>

          <div className="testimonials-grid" data-section="testimonials"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {TESTIMONIALS.map((t, i) => (
              <div key={i}
                className={`fade-up fade-up-delay-${i + 1} ${isVisible('testimonials') ? 'visible' : ''}`}
                style={{
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 20, padding: 28,
                }}>
                <div style={{ fontSize: 32, marginBottom: 16, color: '#22c55e' }}>"</div>
                <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)', lineHeight: 1.8, marginBottom: 24 }}>
                  {t.text}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: t.color, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontWeight: 700, fontSize: 16, color: '#000',
                    flexShrink: 0,
                  }}>{t.avatar}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{t.business}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{
        padding: '100px 32px', background: '#0a0a0a',
        textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600, height: 600,
          background: 'radial-gradient(circle, rgba(34,197,94,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', maxWidth: 700, margin: '0 auto' }}>
          <h2 style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 'clamp(52px, 8vw, 96px)', lineHeight: 0.95, marginBottom: 24,
          }}>
            YOUR COMPETITORS<br />
            ARE ALREADY<br />
            <span style={{ color: '#22c55e' }}>AUTOMATING.</span>
          </h2>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.45)', marginBottom: 40, lineHeight: 1.7 }}>
            Don't let them take your customers. Set up WA AutoBot free today<br />
            and start converting WhatsApp chats into revenue.
          </p>
          <button onClick={() => navigate('/login')}
            className="glow-green"
            style={{
              background: '#22c55e', color: '#000', border: 'none',
              borderRadius: 16, padding: '20px 48px', fontSize: 18,
              fontWeight: 800, cursor: 'pointer', transition: 'all 0.3s',
              display: 'inline-block',
            }}>
            Start Free — Takes 5 Minutes →
          </button>
          <p style={{ marginTop: 20, fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>
            No credit card · Cancel anytime · Nigerian support
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        padding: '40px 32px', background: '#070707',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, background: '#22c55e', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
          }}>⚡</div>
          <span style={{ fontWeight: 700 }}>WA AutoBot</span>
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>© 2025</span>
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          {['Privacy', 'Terms', 'Support'].map(link => (
            <span key={link} style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, cursor: 'pointer' }}
              onMouseEnter={e => e.target.style.color = '#fff'}
              onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.3)'}>
              {link}
            </span>
          ))}
        </div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)' }}>
          Built with ❤️ for Nigerian businesses
        </p>
      </footer>
    </div>
  );
}