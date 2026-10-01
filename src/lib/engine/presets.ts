/**
 * AI Launch QA — Standard Target Presets
 * Pre-configured test environments for instant QA demonstration & comparison
 */

import { TargetPreset } from '../../types/audit';

export const TARGET_PRESETS: TargetPreset[] = [
  {
    id: 'preset-ai-saas-defects',
    name: 'AI-Generated SaaS Landing Page',
    badge: 'Common AI Defects',
    badgeColor: 'amber',
    url: 'https://saas-demo.ailaunchqa.dev/v1/preview',
    description: 'Freshly generated web app with responsive horizontal overflow, missing form labels, dead CTA buttons, and low contrast.',
    type: 'flawed',
    expectedIssues: [
      'Mobile horizontal overflow (390px)',
      'Uncaught TypeError in analytics script',
      'Primary CTA button missing click handler',
      'Hero image missing alt text',
      'Contrast ratio below 4.5:1 on subtitle',
    ],
  },
  {
    id: 'preset-healthy-benchmark',
    name: 'Production Ready Benchmark',
    badge: 'Launch Ready',
    badgeColor: 'emerald',
    url: 'https://benchmark.ailaunchqa.dev/production',
    description: 'Fully optimized web application with strict accessibility, semantic landmarks, Core Web Vitals under 1.2s, and responsive layout.',
    type: 'healthy',
    expectedIssues: [
      'Passes 28/28 checks',
      '0 Critical Blockers',
      'LCP < 1.1s, CLS = 0.00',
    ],
  },
  {
    id: 'preset-ecommerce-checkout',
    name: 'E-Commerce Flow & Checkout',
    badge: 'Conversion Blockers',
    badgeColor: 'rose',
    url: 'https://store-preview.ailaunchqa.dev/checkout',
    description: 'Cart and checkout template with form accessibility gaps, broken discount link, clipped payment badges on mobile, and missing H1.',
    type: 'ecommerce',
    expectedIssues: [
      'Missing accessible form field labels',
      'Broken external affiliate link (404)',
      'Render-blocking stylesheet (480ms delay)',
      'Viewport clipping on credit card inputs',
    ],
  },
];
