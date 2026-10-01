/**
 * LaunchProof — Production Verification Runner Script
 * Executes all 5 production verification passes and outputs a clean report.
 */

import { runProductionVerificationPass } from './prodVerificationSuite';

async function main() {
  console.log('[ProdVerificationRunner] Starting LaunchProof Final Production Verification Pass...\n');
  try {
    const suites = await runProductionVerificationPass();
    let hasFailed = false;

    for (const suite of suites) {
      console.log(`=======================================================`);
      console.log(`Suite: ${suite.name} [${suite.passed ? 'PASS' : 'FAIL'}] (${suite.durationMs}ms)`);
      console.log(`=======================================================`);
      for (const t of suite.tests) {
        console.log(`  - ${t.name}: ${t.passed ? 'PASS' : 'FAIL'} ${t.details ? `(${t.details})` : ''} ${t.error ? `[Error: ${t.error}]` : ''}`);
        if (!t.passed) hasFailed = true;
      }
      console.log('');
    }

    if (hasFailed) {
      console.error('\n[ProdVerificationRunner] Production verification pass FAILED.');
      process.exit(1);
    } else {
      console.log('\n[ProdVerificationRunner] ALL 5 PRODUCTION VERIFICATION SUITES PASSED SUCCESSFULLY!');
      process.exit(0);
    }
  } catch (err: any) {
    console.error('[ProdVerificationRunner] Fatal error during production verification:', err);
    process.exit(1);
  }
}

main();
