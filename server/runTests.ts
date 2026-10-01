/**
 * LaunchProof — Test Runner Script for CI & Local Execution
 * Executes all automated test suites and exits with status 1 on failure.
 */

import { runAllAutomatedTests } from './testSuite';

async function main() {
  console.log('[TestRunner] Running LaunchProof Automated Test Suites...');
  try {
    const suites = await runAllAutomatedTests();
    let hasFailed = false;

    for (const suite of suites) {
      console.log(`\nSuite: ${suite.name} [${suite.passed ? 'PASS' : 'FAIL'}] (${suite.durationMs}ms)`);
      for (const t of suite.tests) {
        console.log(`  - ${t.name}: ${t.passed ? 'PASS' : 'FAIL'} ${t.details ? `(${t.details})` : ''} ${t.error ? `[Error: ${t.error}]` : ''}`);
        if (!t.passed) hasFailed = true;
      }
    }

    if (hasFailed) {
      console.error('\n[TestRunner] One or more test suites failed.');
      process.exit(1);
    } else {
      console.log('\n[TestRunner] All test suites passed successfully!');
      process.exit(0);
    }
  } catch (err: any) {
    console.error('[TestRunner] Fatal error running test suites:', err);
    process.exit(1);
  }
}

main();
