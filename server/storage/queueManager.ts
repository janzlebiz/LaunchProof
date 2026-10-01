/**
 * LaunchProof — Durable Distributed Job Queue & Persistence Ledger
 * Manages atomic job lifecycle, concurrency quotas, leases, and multi-worker state.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AuditConfig, AuditReport, AuditStatus } from '../../src/types/audit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const QUEUE_LEDGER_FILE = path.resolve(DATA_DIR, 'queue_ledger.json');

export interface QueueJobItem {
  id: string;
  targetUrl: string;
  config: AuditConfig;
  status: AuditStatus;
  progressPercent: number;
  currentMessage: string;
  workerId?: string;
  leaseExpiresAt?: number;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export class DurableQueueManager {
  private ledger = new Map<string, QueueJobItem>();
  private readonly maxConcurrentActiveJobs = 3;
  private readonly leaseDurationMs = 45000;

  constructor() {
    this.ensureStorage();
    this.loadLedger();
  }

  private ensureStorage() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private loadLedger() {
    try {
      if (fs.existsSync(QUEUE_LEDGER_FILE)) {
        const raw = fs.readFileSync(QUEUE_LEDGER_FILE, 'utf-8');
        const items: QueueJobItem[] = JSON.parse(raw);
        for (const it of items) {
          this.ledger.set(it.id, it);
        }
      }
    } catch (err) {
      console.warn('[QueueManager] Could not load queue ledger:', err);
    }
  }

  private persistLedger() {
    try {
      const items = Array.from(this.ledger.values()).slice(-100);
      fs.writeFileSync(QUEUE_LEDGER_FILE, JSON.stringify(items, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[QueueManager] Could not persist queue ledger:', err);
    }
  }

  public enqueueJob(auditId: string, targetUrl: string, config: AuditConfig): { success: boolean; job?: QueueJobItem; reason?: string } {
    // Check concurrency capacity gate
    const activeCount = Array.from(this.ledger.values()).filter(
      (j) => j.status === 'CRAWLING' || j.status === 'INITIALIZING' || j.status === 'DETERMINISTIC_CHECKS' || j.status === 'ACCESSIBILITY' || j.status === 'PERFORMANCE' || j.status === 'SCREENSHOT_ANALYSIS' || j.status === 'AI_REASONING'
    ).length;

    if (activeCount >= this.maxConcurrentActiveJobs) {
      return {
        success: false,
        reason: `Concurrency limit reached: ${this.maxConcurrentActiveJobs} active audits in progress. Please wait for an active audit to finish.`,
      };
    }

    const jobItem: QueueJobItem = {
      id: auditId,
      targetUrl,
      config,
      status: 'QUEUED',
      progressPercent: 5,
      currentMessage: 'Audit queued in durable ledger',
      retryCount: 0,
      maxRetries: 2,
      createdAt: new Date().toISOString(),
    };

    this.ledger.set(auditId, jobItem);
    this.persistLedger();
    return { success: true, job: jobItem };
  }

  public claimJob(workerId: string): QueueJobItem | null {
    const now = Date.now();
    for (const job of this.ledger.values()) {
      if (job.status === 'QUEUED' || (job.status !== 'COMPLETED' && job.status !== 'FAILED' && job.status !== 'CANCELLED' && job.leaseExpiresAt && job.leaseExpiresAt < now)) {
        job.status = 'INITIALIZING';
        job.workerId = workerId;
        job.leaseExpiresAt = now + this.leaseDurationMs;
        job.startedAt = job.startedAt || new Date().toISOString();
        this.persistLedger();
        return job;
      }
    }
    return null;
  }

  public renewLease(auditId: string): boolean {
    const job = this.ledger.get(auditId);
    if (!job) return false;
    job.leaseExpiresAt = Date.now() + this.leaseDurationMs;
    return true;
  }

  public updateJobProgress(auditId: string, status: AuditStatus, progressPercent: number, message: string) {
    const job = this.ledger.get(auditId);
    if (!job) return;
    job.status = status;
    job.progressPercent = progressPercent;
    job.currentMessage = message;
    job.leaseExpiresAt = Date.now() + this.leaseDurationMs;
    this.persistLedger();
  }

  public finalizeJob(auditId: string, status: 'COMPLETED' | 'FAILED' | 'CANCELLED', error?: string) {
    const job = this.ledger.get(auditId);
    if (!job) return;
    job.status = status;
    job.completedAt = new Date().toISOString();
    job.error = error;
    delete job.leaseExpiresAt;
    this.persistLedger();
  }

  public getJob(auditId: string): QueueJobItem | undefined {
    return this.ledger.get(auditId);
  }
}

export const queueManager = new DurableQueueManager();
