/**
 * LaunchProof — Real Fixture Test Websites
 * Live HTML endpoints served by LaunchProof for deterministic end-to-end browser audits
 */

import express from 'express';

export function setupFixtureRoutes(app: express.Express) {
  // Fixture 1: AI-Generated SaaS with Intentional Defects
  app.get('/fixtures/defective-saas', (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AI SaaS Generator — Instant Apps</title>
  <!-- Render blocking external font -->
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=block">
  <style>
    body { font-family: 'Inter', sans-serif; background: #0b0f19; color: #f8fafc; margin: 0; padding: 0; }
    header { display: flex; justify-content: space-between; padding: 16px 24px; border-bottom: 1px solid #1e293b; }
    nav a { color: #94a3b8; text-decoration: none; margin-left: 16px; font-size: 14px; }
    .hero { padding: 48px 24px; text-align: center; }
    /* Horizontal overflow bug on 390px mobile */
    .hero-stats-badge-grid { width: 440px; margin: 20px auto; background: #1e293b; padding: 12px; border-radius: 8px; }
    /* Low contrast text (3.1:1 on dark) */
    .hero-subtitle { color: #64748b; font-size: 15px; margin-top: 8px; }
    .btn-primary { background: #0284c7; color: #fff; padding: 10px 20px; border-radius: 6px; border: none; font-weight: bold; cursor: pointer; }
    .btn-secondary { background: #1e293b; color: #94a3b8; padding: 10px 20px; border-radius: 6px; border: 1px solid #334155; margin-left: 10px; cursor: pointer; }
    .newsletter-section { margin-top: 32px; }
    /* Unlabelled input */
    input[type="email"] { padding: 8px 12px; background: #0f172a; border: 1px solid #334155; color: #fff; border-radius: 4px; }
  </style>
</head>
<body>
  <header>
    <div style="font-weight: bold; color: #38bdf8;">AutoSaaS</div>
    <nav>
      <a href="#features">Features</a>
      <a href="/pricing">Pricing</a>
      <!-- Broken external link -->
      <a href="https://docs.external.io/broken-endpoint-404">Documentation</a>
      <!-- Empty href -->
      <a href="#">Support</a>
    </nav>
  </header>

  <main class="hero">
    <h1>Deploy AI Applications In Seconds</h1>
    <p class="hero-subtitle">The intelligent autonomous web app builder for modern engineers.</p>
    
    <div class="hero-stats-badge-grid">
      <span>🚀 10,000+ Apps Generated</span>
      <span style="margin-left: 12px;">⚡ 99.9% Uptime</span>
    </div>

    <div style="margin-top: 24px;">
      <button class="btn-primary">Start Building Free</button>
      <!-- Dead button without handler -->
      <button id="btn-schedule-demo" class="btn-secondary">Schedule Live Demo</button>
    </div>

    <!-- Image missing alt attribute -->
    <div style="margin-top: 36px;">
      <img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=60" style="max-width: 90%; border-radius: 12px; border: 1px solid #334155;" />
    </div>

    <div class="newsletter-section">
      <!-- Input without <label> or aria-label -->
      <input id="email-subscribe" type="email" placeholder="Enter work email..." />
      <button style="padding: 8px 16px; background: #38bdf8; border: none; border-radius: 4px; font-weight: bold;">Subscribe</button>
    </div>
  </main>

  <script>
    // Intentional unhandled runtime exception in analytics
    try {
      window.analytics.track('pageview');
    } catch(e) {
      console.error("Uncaught TypeError: Cannot read properties of undefined (reading 'track')", e);
    }
  </script>
</body>
</html>`);
  });

  // Fixture 2: Production-Ready Healthy Benchmark
  app.get('/fixtures/healthy-benchmark', (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LaunchProof — Production Ready Web Application</title>
  <meta name="description" content="A fully accessible, optimized, and responsive web benchmark with high performance and zero critical issues.">
  <link rel="canonical" href="https://launchproof.dev/fixtures/healthy-benchmark">
  <meta property="og:title" content="LaunchProof Healthy Benchmark">
  <meta property="og:description" content="Production verified web application.">
  <meta property="og:image" content="https://launchproof.dev/og-image.png">
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #090d16; color: #f1f5f9; margin: 0; padding: 0; box-sizing: border-box; }
    header { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-bottom: 1px solid #1e293b; max-width: 1200px; margin: 0 auto; }
    main { max-width: 1200px; margin: 0 auto; padding: 40px 24px; text-align: center; }
    h1 { font-size: clamp(28px, 5vw, 48px); margin-bottom: 16px; color: #ffffff; }
    p { color: #cbd5e1; font-size: 18px; max-width: 600px; margin: 0 auto 32px; line-height: 1.6; }
    .cta-button { background: #06b6d4; color: #02141a; font-weight: 700; padding: 14px 28px; border-radius: 8px; border: none; font-size: 16px; min-height: 48px; min-width: 48px; cursor: pointer; transition: background 0.2s; }
    .cta-button:hover { background: #22d3ee; }
    .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; margin-top: 48px; text-align: left; }
    .feature-card { background: #0f172a; padding: 24px; border-radius: 12px; border: 1px solid #1e293b; }
    .feature-card h2 { font-size: 20px; margin-top: 0; color: #38bdf8; }
    .feature-card p { font-size: 14px; color: #94a3b8; margin-bottom: 0; }
  </style>
</head>
<body>
  <header>
    <nav aria-label="Main Navigation">
      <a href="/" style="font-weight: 800; font-size: 20px; color: #38bdf8; text-decoration: none;">LaunchProof</a>
    </nav>
  </header>
  <main>
    <h1>Ship High Quality Software With Confidence</h1>
    <p>Automated pre-launch verification catching broken elements, accessibility barriers, and mobile layout defects.</p>
    <div>
      <button class="cta-button" onclick="alert('Ready!')">Get Started Free</button>
    </div>
    <div class="features-grid">
      <div class="feature-card">
        <h2>Deterministic QA</h2>
        <p>Over 28 technical and functional checks running against isolated headless browsers.</p>
      </div>
      <div class="feature-card">
        <h2>WCAG 2.1 AA</h2>
        <p>Axe-core accessibility compliance auditing color contrast, labels, and landmarks.</p>
      </div>
      <div class="feature-card">
        <h2>Gemini Vision AI</h2>
        <p>Multimodal reasoning analyzing visual hierarchy, above-the-fold CTA prominence, and layout rhythm.</p>
      </div>
    </div>
  </main>
</body>
</html>`);
  });
}
