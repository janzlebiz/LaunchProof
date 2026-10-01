/**
 * LaunchProof — Queue-Driven Worker Daemon
 * Periodically polls the Durable Queue Ledger, claims queued jobs,
 * executes browser audits, and handles orphaned lease recoveries.
 */

import { queueManager } from '../storage/queueManager';
import { auditStore } from '../storage/auditStore';
import { runBrowserAuditWorker } from './browserWorker';
import { GoogleGenAI } from '@google/genai';
import { deduplicateFindings } from '../../src/lib/engine/dedup';
import { calculateAuditScores } from '../../src/lib/engine/scoring';
import { CHECK_DEFINITIONS } from '../../src/lib/engine/checks';

const WORKER_ID = `worker_${process.pid}_${Math.random().toString(36).substring(2, 6)}`;
let daemonTimer: NodeJS.Timeout | null = null;
let isRunning = false;

export function startQueueDaemon(aiInstance: GoogleGenAI | null) {
  if (daemonTimer) return;

  console.log(`[QueueDaemon] Started worker daemon ID: ${WORKER_ID}`);

  daemonTimer = setInterval(async () => {
    if (isRunning) return;
    isRunning = true;

    try {
      const jobItem = queueManager.claimJob(WORKER_ID);
      if (!jobItem) {
        isRunning = false;
        return;
      }

      console.log(`[QueueDaemon] Claimed job ${jobItem.id} for target ${jobItem.targetUrl}`);

      const auditId = jobItem.id;
      const job = auditStore.getJob(auditId) || auditStore.registerJob(auditId, jobItem.targetUrl);

      try {
        const { report, rawHtml, screenshotBase64Map } = await runBrowserAuditWorker(
          auditId,
          jobItem.targetUrl,
          jobItem.config,
          job.abortController.signal,
          (status, percent, msg, level) => {
            auditStore.updateJob(auditId, status, percent, msg, level);
            queueManager.updateJobProgress(auditId, status, percent, msg);
            queueManager.renewLease(auditId);
          }
        );

        if (jobItem.config.enableAI && aiInstance) {
          auditStore.updateJob(auditId, 'AI_REASONING', 88, 'Running Gemini Vision on real screenshot evidence...', 'info');
          const { runGeminiMultimodalVisualReasoning } = await import('./aiReasoner');
          const aiResult = await runGeminiMultimodalVisualReasoning(
            aiInstance,
            jobItem.targetUrl,
            report.pages[0]?.title || 'Target Page',
            rawHtml,
            report.findings,
            screenshotBase64Map['Desktop (1440x900)'] || screenshotBase64Map['Mobile (390x844)']
          );

          if (aiResult.findings.length > 0) {
            report.findings.push(...aiResult.findings);
            report.findings = deduplicateFindings(report.findings);
            const recalculated = calculateAuditScores(
              report.findings,
              Object.keys(CHECK_DEFINITIONS),
              Date.now() - new Date(report.startedAt).getTime(),
              report.pages.length,
              report.config.viewports.length
            );
            report.summary = {
              ...recalculated.summary,
              executionEngine: report.summary.executionEngine,
              aiReasoningStatus: aiResult.status,
            };
            report.categoryScores = recalculated.categoryScores;
          } else {
            report.summary.aiReasoningStatus = aiResult.status;
          }
        }

        auditStore.completeJob(auditId, report);
        queueManager.finalizeJob(auditId, 'COMPLETED');
        console.log(`[QueueDaemon] Completed job ${auditId}`);
      } catch (err: any) {
        console.error(`[QueueDaemon] Job ${auditId} failed:`, err.message);
        auditStore.failJob(auditId, err.message || 'Audit failed');
        queueManager.finalizeJob(auditId, 'FAILED', err.message);
      }
    } catch (err) {
      console.error('[QueueDaemon] Error in polling loop:', err);
    } finally {
      isRunning = false;
    }
  }, 2000);
}

export function stopQueueDaemon() {
  if (daemonTimer) {
    clearInterval(daemonTimer);
    daemonTimer = null;
  }
}
