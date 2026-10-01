/**
 * LaunchProof — Durable Audit Store & Job Lifecycle Manager
 * Stores audit reports to JSON disk storage, manages active AbortControllers,
 * worker heartbeats watchdog, concurrency rate limits, and retention policy.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AuditReport, AuditStatus } from '../../src/types/audit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_FILE = path.resolve(DATA_DIR, 'audits.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface ActiveJob {
  auditId: string;
  targetUrl: string;
  status: AuditStatus;
  progressPercent: number;
  currentMessage: string;
  logs: { id: string; timestamp: string; level: string; message: string; step?: string }[];
  abortController: AbortController;
  startedAt: string;
  heartbeatAt: number;
  report: AuditReport | null;
  error?: string;
}

const MAX_CONCURRENT_AUDITS = 3;

class AuditStoreManager {
  private activeJobs = new Map<string, ActiveJob>();
  private completedAudits = new Map<string, AuditReport>();
  private domainAuditCounts = new Map<string, { count: number; lastTime: number }>();
  private watchdogTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.loadFromDisk();
    this.startWatchdog();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const list: AuditReport[] = JSON.parse(raw);
        for (const r of list) {
          this.completedAudits.set(r.id, r);
        }
      }
    } catch (err) {
      console.warn('Could not load existing audits from disk:', err);
    }
  }

  private saveToDisk() {
    try {
      const list = Array.from(this.completedAudits.values()).slice(-50);
      fs.writeFileSync(DB_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Could not persist audits to disk:', err);
    }
  }

  // Watchdog Heartbeat Monitor: Recovers stale / orphan jobs
  private startWatchdog() {
    this.watchdogTimer = setInterval(() => {
      const now = Date.now();
      for (const [id, job] of this.activeJobs.entries()) {
        if (job.status !== 'COMPLETED' && job.status !== 'FAILED' && job.status !== 'CANCELLED') {
          // If no update for 45s, mark as timed out / crash recovered
          if (now - job.heartbeatAt > 45000) {
            console.warn(`[Watchdog] Recovering orphaned job ${id} (heartbeat expired)`);
            job.status = 'FAILED';
            job.error = 'Worker timeout: execution exceeded maximum active window';
            job.currentMessage = 'Audit terminated by watchdog recovery.';
            job.abortController.abort();
          }
        }
      }
    }, 10000);
  }

  // Check concurrency capacity
  public canAcceptNewJob(): { allowed: boolean; reason?: string } {
    const runningCount = Array.from(this.activeJobs.values()).filter(
      (j) => j.status !== 'COMPLETED' && j.status !== 'FAILED' && j.status !== 'CANCELLED'
    ).length;

    if (runningCount >= MAX_CONCURRENT_AUDITS) {
      return { allowed: false, reason: `Server busy: Maximum ${MAX_CONCURRENT_AUDITS} concurrent audits running.` };
    }
    return { allowed: true };
  }

  // Rate Limiting
  public checkRateLimit(targetUrl: string): { allowed: boolean; waitSeconds?: number } {
    try {
      const domain = new URL(targetUrl).hostname;
      const now = Date.now();
      const rec = this.domainAuditCounts.get(domain);

      if (!rec || now - rec.lastTime > 60000) {
        this.domainAuditCounts.set(domain, { count: 1, lastTime: now });
        return { allowed: true };
      }

      if (rec.count >= 8) {
        const wait = Math.ceil((60000 - (now - rec.lastTime)) / 1000);
        return { allowed: false, waitSeconds: wait };
      }

      rec.count++;
      return { allowed: true };
    } catch {
      return { allowed: true };
    }
  }

  public registerJob(auditId: string, targetUrl: string): ActiveJob {
    const controller = new AbortController();
    const job: ActiveJob = {
      auditId,
      targetUrl,
      status: 'QUEUED',
      progressPercent: 5,
      currentMessage: 'Job queued. Allocating isolated worker context...',
      logs: [],
      abortController: controller,
      startedAt: new Date().toISOString(),
      heartbeatAt: Date.now(),
      report: null,
    };

    this.activeJobs.set(auditId, job);
    return job;
  }

  public getJob(auditId: string): ActiveJob | undefined {
    return this.activeJobs.get(auditId);
  }

  public updateJob(
    auditId: string,
    status: AuditStatus,
    progressPercent: number,
    message: string,
    level: string = 'info'
  ) {
    const job = this.activeJobs.get(auditId);
    if (!job) return;

    job.status = status;
    job.progressPercent = progressPercent;
    job.currentMessage = message;
    job.heartbeatAt = Date.now();
    job.logs.push({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      step: status,
    });
  }

  public completeJob(auditId: string, report: AuditReport) {
    const job = this.activeJobs.get(auditId);
    if (job) {
      job.status = 'COMPLETED';
      job.progressPercent = 100;
      job.currentMessage = `Completed with verdict ${report.summary.verdict}`;
      job.report = report;
    }
    this.completedAudits.set(auditId, report);
    this.saveToDisk();
  }

  public failJob(auditId: string, errorMsg: string) {
    const job = this.activeJobs.get(auditId);
    if (job) {
      job.status = 'FAILED';
      job.error = errorMsg;
      job.currentMessage = `Audit failed: ${errorMsg}`;
      job.logs.push({
        id: `err_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        level: 'error',
        message: errorMsg,
        step: 'FAILED',
      });
    }
  }

  public cancelJob(auditId: string): boolean {
    const job = this.activeJobs.get(auditId);
    if (!job) return false;

    job.abortController.abort();
    job.status = 'CANCELLED';
    job.currentMessage = 'Audit was cancelled by user.';
    job.logs.push({
      id: `cancel_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      level: 'warn',
      message: 'Worker execution aborted.',
      step: 'CANCELLED',
    });
    return true;
  }

  public getReport(auditId: string): AuditReport | undefined {
    return this.completedAudits.get(auditId) || this.activeJobs.get(auditId)?.report || undefined;
  }

  public getAllReports(): AuditReport[] {
    return Array.from(this.completedAudits.values()).reverse();
  }
}

export const auditStore = new AuditStoreManager();
