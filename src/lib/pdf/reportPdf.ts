/**
 * LaunchProof — PDF Report Generator
 * Generates an executive-grade, printable QA audit report using jsPDF
 */

import { jsPDF } from 'jspdf';
import { AuditReport } from '../../types/audit';

export function generateAuditPdf(report: AuditReport): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 18;

  // Header Bar
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('LaunchProof — Website Audit Report', 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`Target: ${report.targetUrl} | Date: ${new Date(report.startedAt).toLocaleDateString()}`, 14, 20);

  y = 36;

  // Launch Verdict Banner
  const isBlocked = report.summary.verdict === 'LAUNCH_BLOCKED';
  const isReview = report.summary.verdict === 'NEEDS_REVIEW';

  if (isBlocked) {
    doc.setFillColor(254, 242, 242); // red-50
    doc.setDrawColor(239, 68, 68); // red-500
  } else if (isReview) {
    doc.setFillColor(254, 252, 232); // amber-50
    doc.setDrawColor(245, 158, 11); // amber-500
  } else {
    doc.setFillColor(240, 253, 244); // emerald-50
    doc.setDrawColor(16, 185, 129); // emerald-500
  }

  doc.setLineWidth(0.5);
  doc.roundedRect(14, y, pageWidth - 28, 22, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  if (isBlocked) doc.setTextColor(185, 28, 28);
  else if (isReview) doc.setTextColor(180, 83, 9);
  else doc.setTextColor(4, 120, 87);

  doc.text(`LAUNCH VERDICT: ${report.summary.verdict.replace('_', ' ')} (Score: ${report.summary.overallScore}/100)`, 20, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(report.summary.verdictReason, 20, y + 16, { maxWidth: pageWidth - 42 });

  y += 28;

  // Executive Summary Grid
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Executive Summary', 14, y);
  y += 6;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, y, pageWidth - 28, 18, 1, 1, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`Total Findings: ${report.summary.totalFindings}`, 20, y + 7);
  doc.text(`Critical Blockers: ${report.summary.criticalCount}`, 70, y + 7);
  doc.text(`High Priority: ${report.summary.highCount}`, 125, y + 7);
  doc.text(`Pages Audited: ${report.summary.pagesAudited}`, 20, y + 13);
  doc.text(`Viewports: ${report.summary.viewportsTested}`, 70, y + 13);
  doc.text(`Duration: ${(report.summary.durationMs / 1000).toFixed(1)}s`, 125, y + 13);

  y += 26;

  // Category Scores Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Category Score Breakdown', 14, y);
  y += 6;

  for (const cat of report.categoryScores) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(cat.name, 16, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Weight: ${Math.round(cat.weight * 100)}% | Passed: ${cat.passedCount} | Failed: ${cat.failedCount}`, 85, y);

    // Score badge
    doc.setFont('helvetica', 'bold');
    if (cat.score >= 85) doc.setTextColor(16, 185, 129);
    else if (cat.score >= 70) doc.setTextColor(245, 158, 11);
    else doc.setTextColor(239, 68, 68);

    doc.text(`${cat.score} / 100`, pageWidth - 32, y);
    y += 6;
  }

  y += 6;

  // Prioritized Findings Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Prioritized Findings & Remediation Guidance', 14, y);
  y += 6;

  for (let i = 0; i < report.findings.length; i++) {
    const f = report.findings[i];

    if (y > 250) {
      doc.addPage();
      y = 18;
    }

    let badgeColor = [100, 116, 139];
    if (f.severity === 'critical') badgeColor = [220, 38, 38];
    else if (f.severity === 'high') badgeColor = [234, 88, 12];
    else if (f.severity === 'medium') badgeColor = [217, 119, 6];
    else if (f.severity === 'low') badgeColor = [37, 99, 235];

    doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
    doc.roundedRect(14, y - 4, 18, 5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text(f.severity.toUpperCase(), 16, y - 0.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`${i + 1}. ${f.title}`, 36, y);

    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Category: ${f.category.toUpperCase()} | Confidence: ${Math.round(f.confidence * 100)}% | Source: ${f.source}`, 36, y);
    y += 4;

    doc.setTextColor(51, 65, 85);
    doc.text(`Description: ${f.description}`, 14, y, { maxWidth: pageWidth - 28 });
    y += 7;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Impact: ', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(f.impact, 26, y, { maxWidth: pageWidth - 40 });
    y += 5;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Fix: ', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(13, 148, 136);
    doc.text(f.recommendation, 22, y, { maxWidth: pageWidth - 36 });
    y += 8;

    doc.setDrawColor(226, 232, 240);
    doc.line(14, y, pageWidth - 14, y);
    y += 5;
  }

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`LaunchProof Report — Page ${p} of ${totalPages}`, 14, 290);
    doc.text('Generated by LaunchProof Pre-Launch Platform', pageWidth - 70, 290);
  }

  return doc;
}
