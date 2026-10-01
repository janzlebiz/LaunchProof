/**
 * LaunchProof — Target Presets
 * Pre-configured live test environments for instant QA testing and comparison
 */

import { TargetPreset } from '../../types/audit';

export const TARGET_PRESETS: TargetPreset[] = [
  {
    id: 'preset-ai-saas-defects',
    name: 'Live Fixture: AI SaaS (Intentional Defects)',
    badge: 'Live Fixture',
    badgeColor: 'amber',
    url: window.location.origin ? `${window.location.origin}/fixtures/defective-saas` : 'http://localhost:3000/fixtures/defective-saas',
    description: 'Live test fixture containing real horizontal overflow (440px), missing image alt text, unlabelled input, broken 404 documentation link, and low contrast (3.1:1).',
    type: 'flawed',
    expectedIssues: [
      'Mobile horizontal overflow on 390px',
      'Image missing alt attribute',
      'Unlabelled form email input',
      'Broken link returning 404',
      'Render-blocking font in <head>',
    ],
  },
  {
    id: 'preset-healthy-benchmark',
    name: 'Live Fixture: Production Ready Benchmark',
    badge: 'Production Benchmark',
    badgeColor: 'emerald',
    url: window.location.origin ? `${window.location.origin}/fixtures/healthy-benchmark` : 'http://localhost:3000/fixtures/healthy-benchmark',
    description: 'Live benchmark page with full accessibility, semantic headings, responsive design, and Core Web Vitals under 1.2s.',
    type: 'healthy',
    expectedIssues: [
      'Passes 28/28 checks',
      '0 Critical Blockers',
      'LCP < 1.2s, CLS = 0.00',
    ],
  },
];
