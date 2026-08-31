import { useEffect, useRef } from "react";

/**
 * AuthBackground — ambient 3D workflow scene for auth pages.
 *
 * Renders a field of translucent "claim" panels drifting on layered
 * depth planes, joined by thin traced connector lines, evoking a claim
 * moving stage-to-stage through the workflow graph. A rotating 3D
 * claim-stack + approval seal is the main signature object, and a
 * vector-drawn gold anniversary medallion floats as a second badge.
 * Pure CSS 3D (perspective + rotateX/Y), with subtle pointer-parallax.
 * Respects prefers-reduced-motion.
 */
export default function AuthBackground() {
  const sceneRef = useRef(null);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) return;

    let raf = null;
    const handlePointerMove = (e) => {
      const { innerWidth, innerHeight } = window;
      const x = (e.clientX / innerWidth - 0.5) * 2;
      const y = (e.clientY / innerHeight - 0.5) * 2;

      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        scene.style.setProperty("--parallax-x", x.toFixed(3));
        scene.style.setProperty("--parallax-y", y.toFixed(3));
      });
    };

    window.addEventListener("pointermove", handlePointerMove);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const nodes = [
    { id: "n1", top: "18%", left: "12%", depth: 1, state: "done" },
    { id: "n2", top: "30%", left: "34%", depth: 2, state: "done" },
    { id: "n3", top: "16%", left: "58%", depth: 1, state: "active" },
    { id: "n4", top: "42%", left: "74%", depth: 3, state: "pending" },
    { id: "n5", top: "62%", left: "22%", depth: 2, state: "done" },
    { id: "n6", top: "70%", left: "48%", depth: 1, state: "active" },
    { id: "n7", top: "58%", left: "84%", depth: 2, state: "pending" },
    { id: "n8", top: "84%", left: "64%", depth: 3, state: "pending" },
  ];

  const edges = [
    ["n1", "n2"],
    ["n2", "n3"],
    ["n3", "n4"],
    ["n2", "n5"],
    ["n5", "n6"],
    ["n6", "n7"],
    ["n6", "n8"],
    ["n4", "n7"],
  ];

  const pos = Object.fromEntries(nodes.map((n) => [n.id, n]));

  return (
    <div className="auth-bg-root" aria-hidden="true">
      <style>{`
        .auth-bg-root {
          position: absolute;
          inset: 0;
          overflow: hidden;
          background:
            radial-gradient(120% 90% at 15% 10%, hsl(217 71% 22%) 0%, transparent 55%),
            radial-gradient(100% 80% at 85% 90%, hsl(217 60% 16%) 0%, transparent 50%),
            hsl(222 47% 9%);
        }

        .auth-bg-scene {
          position: absolute;
          inset: -10%;
          perspective: 1400px;
          transform-style: preserve-3d;
        }

        .auth-bg-plane {
          position: absolute;
          inset: 0;
          transform-style: preserve-3d;
          transform:
            rotateY(calc(var(--parallax-x, 0) * 3deg))
            rotateX(calc(var(--parallax-y, 0) * -3deg));
          transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
        }

        .auth-bg-grid {
          position: absolute;
          inset: -20%;
          background-image:
            linear-gradient(hsl(217 40% 40% / 0.10) 1px, transparent 1px),
            linear-gradient(90deg, hsl(217 40% 40% / 0.10) 1px, transparent 1px);
          background-size: 64px 64px;
          transform: rotateX(62deg) translateZ(-260px);
          transform-origin: center;
          mask-image: radial-gradient(60% 60% at 50% 40%, black 40%, transparent 85%);
        }

        .auth-bg-edges {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          overflow: visible;
        }

        .auth-bg-edges path {
          fill: none;
          stroke: hsl(217 71% 60% / 0.35);
          stroke-width: 1;
          stroke-dasharray: 4 6;
          animation: auth-bg-dash 18s linear infinite;
        }

        @keyframes auth-bg-dash {
          to { stroke-dashoffset: -200; }
        }

        .auth-bg-node {
          position: absolute;
          width: 84px;
          height: 56px;
          border-radius: 8px;
          border: 1px solid hsl(217 71% 65% / 0.35);
          background: linear-gradient(155deg, hsl(217 71% 30% / 0.55), hsl(217 71% 18% / 0.35));
          backdrop-filter: blur(2px);
          box-shadow:
            0 18px 30px -12px hsl(222 47% 4% / 0.6),
            inset 0 1px 0 hsl(217 71% 80% / 0.15);
          animation: auth-bg-float 7s ease-in-out infinite;
        }

        .auth-bg-node::before {
          content: "";
          position: absolute;
          left: 10px;
          right: 10px;
          top: 10px;
          height: 2px;
          border-radius: 2px;
          background: hsl(217 71% 80% / 0.3);
        }
        .auth-bg-node::after {
          content: "";
          position: absolute;
          left: 10px;
          right: 26px;
          top: 18px;
          height: 2px;
          border-radius: 2px;
          background: hsl(217 71% 80% / 0.18);
        }

        .auth-bg-node[data-state="active"] {
          border-color: hsl(40 90% 55% / 0.55);
          background: linear-gradient(155deg, hsl(40 80% 34% / 0.55), hsl(217 71% 18% / 0.35));
        }
        .auth-bg-node[data-state="active"]::before {
          background: hsl(40 90% 70% / 0.55);
        }

        .auth-bg-node[data-state="done"] {
          opacity: 0.55;
        }

        .auth-bg-dot {
          position: absolute;
          top: -5px;
          right: -5px;
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: hsl(160 60% 45%);
          box-shadow: 0 0 0 3px hsl(222 47% 9%);
        }
        .auth-bg-node[data-state="active"] .auth-bg-dot {
          background: hsl(40 90% 55%);
          animation: auth-bg-pulse 1.8s ease-in-out infinite;
        }
        .auth-bg-node[data-state="pending"] .auth-bg-dot {
          background: hsl(220 9% 46%);
        }

        @keyframes auth-bg-pulse {
          0%, 100% { box-shadow: 0 0 0 3px hsl(222 47% 9%), 0 0 0 0 hsl(40 90% 55% / 0.5); }
          50% { box-shadow: 0 0 0 3px hsl(222 47% 9%), 0 0 0 6px hsl(40 90% 55% / 0); }
        }

        @keyframes auth-bg-float {
          0%, 100% { transform: translateZ(var(--z, 0px)) translateY(0px) rotateY(-6deg); }
          50% { transform: translateZ(var(--z, 0px)) translateY(-14px) rotateY(6deg); }
        }

        .auth-bg-vignette {
          position: absolute;
          inset: 0;
          background: radial-gradient(120% 100% at 50% 0%, transparent 40%, hsl(222 47% 9% / 0.7) 100%);
        }

        @media (max-width: 768px) {
          .auth-bg-node { width: 64px; height: 44px; }
        }

        /* ---- Signature element: rotating claim-stack + approval seal ---- */
        .auth-bg-hero {
          position: absolute;
          top: 8%;
          right: 6%;
          width: 190px;
          height: 190px;
          perspective: 900px;
        }

        .auth-bg-hero-spin {
          position: relative;
          width: 100%;
          height: 100%;
          transform-style: preserve-3d;
          animation: auth-bg-hero-rotate 16s linear infinite;
        }

        .auth-bg-doc {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 120px;
          height: 84px;
          margin: -42px 0 0 -60px;
          border-radius: 10px;
          border: 1px solid hsl(217 71% 68% / 0.4);
          background: linear-gradient(160deg, hsl(217 60% 26% / 0.75), hsl(217 71% 14% / 0.55));
          box-shadow: 0 20px 40px -16px hsl(222 47% 4% / 0.65);
          backface-visibility: hidden;
        }
        .auth-bg-doc::before {
          content: "";
          position: absolute;
          left: 14px;
          right: 14px;
          top: 16px;
          height: 3px;
          border-radius: 2px;
          background: hsl(217 71% 82% / 0.35);
        }
        .auth-bg-doc::after {
          content: "";
          position: absolute;
          left: 14px;
          right: 34px;
          top: 28px;
          height: 3px;
          border-radius: 2px;
          background: hsl(217 71% 82% / 0.2);
        }
        .auth-bg-doc-2 { left: 14px; top: 8px; }
        .auth-bg-doc-3 { left: 14px; top: -8px; }

        .auth-bg-doc-1 { transform: translateZ(0px) rotate(-4deg); }
        .auth-bg-doc-2 { transform: translateZ(14px) rotate(3deg); }
        .auth-bg-doc-3 { transform: translateZ(28px) rotate(-2deg); }

        .auth-bg-seal {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 62px;
          height: 62px;
          margin: -31px 0 0 -31px;
          transform: translateZ(46px);
          border-radius: 999px;
          background: linear-gradient(160deg, hsl(40 90% 58%), hsl(38 85% 42%));
          box-shadow:
            0 14px 26px -8px hsl(30 60% 20% / 0.6),
            inset 0 1px 0 hsl(50 100% 85% / 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .auth-bg-seal svg {
          width: 28px;
          height: 28px;
        }

        .auth-bg-hero-back {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 120px;
          height: 84px;
          margin: -42px 0 0 -60px;
          border-radius: 10px;
          background: hsl(217 71% 12%);
          transform: translateZ(-2px) rotateY(180deg);
          backface-visibility: hidden;
        }

        @keyframes auth-bg-hero-rotate {
          from { transform: rotateY(0deg) rotateX(6deg); }
          to { transform: rotateY(360deg) rotateX(6deg); }
        }

        @media (max-width: 1024px) {
          .auth-bg-hero { display: none; }
        }

        /* ---- Vector-drawn gold anniversary medallion, own depth plane ---- */
        .auth-bg-logo-badge {
          position: absolute;
          top: 62%;
          left: 8%;
          width: 84px;
          height: 84px;
          perspective: 700px;
        }

        .auth-bg-logo-spin {
          width: 100%;
          height: 100%;
          transform-style: preserve-3d;
          animation: auth-bg-logo-rotate 12s ease-in-out infinite;
          filter: drop-shadow(0 14px 24px hsl(222 47% 4% / 0.6));
        }

        .auth-bg-logo-spin svg {
          width: 100%;
          height: 100%;
          backface-visibility: hidden;
        }

        @keyframes auth-bg-logo-rotate {
          0%, 100% { transform: translateY(0px) rotateY(-14deg) rotateX(4deg); }
          50% { transform: translateY(-10px) rotateY(14deg) rotateX(-4deg); }
        }

        @media (max-width: 640px) {
          .auth-bg-logo-badge { width: 56px; height: 56px; top: 70%; left: 6%; }
        }
      `}</style>

      <div className="auth-bg-grid" />

      <div className="auth-bg-logo-badge">
        <div className="auth-bg-logo-spin">
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="sealGold" cx="35%" cy="30%" r="75%">
                <stop offset="0%" stopColor="#fff3c4" />
                <stop offset="45%" stopColor="#f2c351" />
                <stop offset="100%" stopColor="#b8842c" />
              </radialGradient>
              <linearGradient id="sealRing" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1e3a6e" />
                <stop offset="100%" stopColor="#0f2347" />
              </linearGradient>
            </defs>

            {/* outer navy ring */}
            <circle cx="100" cy="100" r="96" fill="url(#sealRing)" />
            <circle
              cx="100"
              cy="100"
              r="96"
              fill="none"
              stroke="#f2c351"
              strokeWidth="1.5"
              opacity="0.6"
            />

            {/* gold medallion */}
            <circle cx="100" cy="100" r="80" fill="url(#sealGold)" />
            <circle
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke="#0f2347"
              strokeWidth="2"
              opacity="0.4"
            />

            {/* inner pale disc */}
            <circle cx="100" cy="100" r="58" fill="#f6f1e4" />
            <circle
              cx="100"
              cy="100"
              r="58"
              fill="none"
              stroke="#b8842c"
              strokeWidth="2"
            />

            {/* curved corporation text */}
            <path
              id="sealTextPath"
              d="M 30 100 A 70 70 0 0 1 170 100"
              fill="none"
            />
            <text
              fontSize="11"
              fontWeight="700"
              letterSpacing="2"
              fill="#0f2347"
            >
              <textPath
                href="#sealTextPath"
                startOffset="50%"
                textAnchor="middle"
              >
                ETHIOPIAN INSURANCE CORP.
              </textPath>
            </text>

            {/* shield with EIC monogram */}
            <path
              d="M100 60 L128 70 V104 C128 126 116 140 100 148 C84 140 72 126 72 104 V70 Z"
              fill="#0f2347"
              stroke="#f2c351"
              strokeWidth="2"
            />
            <text
              x="100"
              y="108"
              fontSize="22"
              fontWeight="800"
              fill="#f2c351"
              textAnchor="middle"
              fontFamily="serif"
            >
              EIC
            </text>

            {/* small flanking stars */}
            <circle cx="34" cy="100" r="3" fill="#0f2347" />
            <circle cx="166" cy="100" r="3" fill="#0f2347" />

            {/* anniversary ribbon */}
            <rect x="62" y="150" width="76" height="18" rx="3" fill="#0f2347" />
            <text
              x="100"
              y="163"
              fontSize="9"
              fontWeight="700"
              letterSpacing="1"
              fill="#f2c351"
              textAnchor="middle"
            >
              50 YEARS
            </text>
          </svg>
        </div>
      </div>

      <div className="auth-bg-hero">
        <div className="auth-bg-hero-spin">
          <div className="auth-bg-hero-back" />
          <div className="auth-bg-doc auth-bg-doc-3" />
          <div className="auth-bg-doc auth-bg-doc-2" />
          <div className="auth-bg-doc auth-bg-doc-1" />
          <div className="auth-bg-seal">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M5 13l4 4L19 7"
                stroke="hsl(222 47% 12%)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>

      <div className="auth-bg-scene" ref={sceneRef}>
        <div className="auth-bg-plane">
          <svg className="auth-bg-edges">
            {edges.map(([a, b], i) => {
              const from = pos[a];
              const to = pos[b];
              return (
                <path
                  key={i}
                  d={`M ${from.left} ${from.top} L ${to.left} ${to.top}`}
                  style={{ vectorEffect: "non-scaling-stroke" }}
                />
              );
            })}
          </svg>

          {nodes.map((n, i) => (
            <div
              key={n.id}
              className="auth-bg-node"
              data-state={n.state}
              style={{
                top: n.top,
                left: n.left,
                "--z": `${n.depth * 40}px`,
                animationDelay: `${i * 0.6}s`,
              }}
            >
              <span className="auth-bg-dot" />
            </div>
          ))}
        </div>
      </div>

      <div className="auth-bg-vignette" />
    </div>
  );
}
