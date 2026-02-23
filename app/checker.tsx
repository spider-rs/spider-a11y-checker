"use client";

import { useState } from "react";
import SearchBar from "./searchbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

interface A11yIssue {
  rule: string;
  severity: "error" | "warning" | "info";
  message: string;
  suggestion: string;
}

interface PageAudit {
  url: string;
  score: number;
  issues: A11yIssue[];
}

function checkA11y(url: string, html: string): PageAudit {
  const issues: A11yIssue[] = [];
  let score = 100;

  if (!/<html[^>]*lang=/i.test(html)) {
    issues.push({ rule: "html-lang", severity: "error", message: "Missing lang attribute on <html>", suggestion: 'Add lang="en" to the <html> tag' });
    score -= 10;
  }

  const noAltImgs = (html.match(/<img(?![^>]*alt=)[^>]*>/gi) || []).length;
  if (noAltImgs > 0) {
    issues.push({ rule: "img-alt", severity: "error", message: `${noAltImgs} image(s) missing alt attribute`, suggestion: "Add descriptive alt text to all images" });
    score -= Math.min(20, noAltImgs * 5);
  }

  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
  if (h1Count > 1) {
    issues.push({ rule: "single-h1", severity: "warning", message: `${h1Count} H1 tags found`, suggestion: "Use only one H1 per page" });
    score -= 5;
  } else if (h1Count === 0) {
    issues.push({ rule: "single-h1", severity: "warning", message: "No H1 tag found", suggestion: "Add a single H1 heading" });
    score -= 5;
  }

  const headingLevels = (html.match(/<h([1-6])[\s>]/gi) || []).map((m) => parseInt(m[2]));
  for (let i = 1; i < headingLevels.length; i++) {
    if (headingLevels[i] - headingLevels[i - 1] > 1) {
      issues.push({ rule: "heading-order", severity: "warning", message: `Heading level skipped: H${headingLevels[i - 1]} to H${headingLevels[i]}`, suggestion: "Use sequential heading levels" });
      score -= 5;
      break;
    }
  }

  const emptyLinks = (html.match(/<a[^>]*>\s*<\/a>/gi) || []).length;
  if (emptyLinks > 0) {
    issues.push({ rule: "empty-links", severity: "error", message: `${emptyLinks} empty link(s) found`, suggestion: "Add text content or aria-label to links" });
    score -= Math.min(10, emptyLinks * 3);
  }

  const inputs = (html.match(/<input[^>]*type=["'](?:text|email|password|tel|number|search)["'][^>]*>/gi) || []).length;
  const labels = (html.match(/<label/gi) || []).length;
  if (inputs > labels) {
    issues.push({ rule: "form-labels", severity: "error", message: `${inputs - labels} input(s) potentially missing labels`, suggestion: "Associate a <label> with each form input" });
    score -= Math.min(15, (inputs - labels) * 5);
  }

  const hasMain = /<main[\s>]/i.test(html) || /role=["']main["']/i.test(html);
  const hasNav = /<nav[\s>]/i.test(html) || /role=["']navigation["']/i.test(html);
  if (!hasMain) {
    issues.push({ rule: "landmark-main", severity: "info", message: "No <main> landmark found", suggestion: "Wrap main content in a <main> element" });
    score -= 3;
  }
  if (!hasNav) {
    issues.push({ rule: "landmark-nav", severity: "info", message: "No <nav> landmark found", suggestion: "Wrap navigation in a <nav> element" });
    score -= 2;
  }

  return { url, score: Math.max(0, score), issues };
}

type Severity = "all" | "error" | "warning" | "info";
type SortKey = "score" | "url" | "issues";
type SortDir = "asc" | "desc";
type ExportFormat = "json" | "csv" | "markdown";

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-400";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
}

function scoreStroke(score: number): string {
  if (score >= 80) return "#4ade80";
  if (score >= 50) return "#facc15";
  return "#f87171";
}

function scoreBg(score: number): string {
  if (score >= 90) return "bg-green-500/10 border-green-500/20";
  if (score >= 70) return "bg-yellow-500/10 border-yellow-500/20";
  if (score >= 50) return "bg-orange-500/10 border-orange-500/20";
  return "bg-red-500/10 border-red-500/20";
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportAudits(audits: PageAudit[], format: ExportFormat) {
  const ts = new Date().toISOString().slice(0, 10);
  if (format === "json") {
    downloadBlob(JSON.stringify(audits, null, 2), `a11y-audit-${ts}.json`, "application/json");
  } else if (format === "csv") {
    const rows = [["URL", "Score", "Rule", "Severity", "Message", "Suggestion"]];
    for (const a of audits) {
      if (a.issues.length === 0) {
        rows.push([a.url, String(a.score), "", "", "No issues", ""]);
      } else {
        for (const i of a.issues) {
          rows.push([a.url, String(a.score), i.rule, i.severity, i.message, i.suggestion]);
        }
      }
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    downloadBlob(csv, `a11y-audit-${ts}.csv`, "text/csv");
  } else {
    let md = `# Accessibility Audit Report\n\n**Date:** ${ts}\n**Pages Audited:** ${audits.length}\n\n`;
    const avg = audits.length ? Math.round(audits.reduce((s, a) => s + a.score, 0) / audits.length) : 0;
    md += `**Average Score:** ${avg}/100\n\n---\n\n`;
    for (const a of audits) {
      md += `## ${a.url}\n\n**Score:** ${a.score}/100\n\n`;
      if (a.issues.length === 0) {
        md += "No issues found.\n\n";
      } else {
        md += "| Severity | Rule | Message | Suggestion |\n|----------|------|---------|------------|\n";
        for (const i of a.issues) {
          md += `| ${i.severity.toUpperCase()} | ${i.rule} | ${i.message} | ${i.suggestion} |\n`;
        }
        md += "\n";
      }
    }
    downloadBlob(md, `a11y-audit-${ts}.md`, "text/markdown");
  }
}

function ScoreRing({ score, size = 72 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  return (
    <svg width={size} height={size} className="block">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={4} className="text-muted/30" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={scoreStroke(score)} strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-700"
      />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central" className={`text-lg font-bold fill-current ${scoreColor(score)}`}>
        {score}
      </text>
    </svg>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`inline-block ml-1 text-[10px] ${active ? "text-[#3bde77]" : "text-muted-foreground/40"}`}>
      {active ? (dir === "asc" ? "▲" : "▼") : "⇅"}
    </span>
  );
}

export default function Checker() {
  const [data, setData] = useState<any[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<Severity>("all");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("json");
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(url);
      toast({ title: "Copied", description: url });
      setTimeout(() => setCopiedUrl(null), 2000);
    });
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "url" ? "asc" : "asc");
    }
  };

  const audits = (data || []).filter((p) => p?.url && p?.content).map((p) => checkA11y(p.url, p.content));
  const avgScore = audits.length ? Math.round(audits.reduce((s, a) => s + a.score, 0) / audits.length) : 0;

  const allIssues = audits.flatMap((a) => a.issues);
  const errorCount = allIssues.filter((i) => i.severity === "error").length;
  const warningCount = allIssues.filter((i) => i.severity === "warning").length;
  const infoCount = allIssues.filter((i) => i.severity === "info").length;

  // Filter
  const filteredAudits = filter === "all"
    ? audits
    : audits.filter((a) => a.issues.some((i) => i.severity === filter));

  // Sort
  const sortedAudits = [...filteredAudits].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "score") cmp = a.score - b.score;
    else if (sortKey === "url") cmp = a.url.localeCompare(b.url);
    else cmp = a.issues.length - b.issues.length;
    return sortDir === "asc" ? cmp : -cmp;
  });

  const filterCounts: Record<Severity, number> = {
    all: audits.length,
    error: audits.filter((a) => a.issues.some((i) => i.severity === "error")).length,
    warning: audits.filter((a) => a.issues.some((i) => i.severity === "warning")).length,
    info: audits.filter((a) => a.issues.some((i) => i.severity === "info")).length,
  };

  // Score distribution for mini bar chart
  const scoreBuckets = [
    { label: "90-100", count: audits.filter((a) => a.score >= 90).length, color: "bg-green-500" },
    { label: "70-89", count: audits.filter((a) => a.score >= 70 && a.score < 90).length, color: "bg-green-500/60" },
    { label: "50-69", count: audits.filter((a) => a.score >= 50 && a.score < 70).length, color: "bg-yellow-500" },
    { label: "0-49", count: audits.filter((a) => a.score < 50).length, color: "bg-red-500" },
  ];
  const maxBucket = Math.max(1, ...scoreBuckets.map((b) => b.count));

  return (
    <div className="flex flex-col h-screen">
      <SearchBar setDataValues={setData} />
      <div className="flex-1 overflow-auto p-4 max-w-5xl mx-auto w-full">
        {audits.length > 0 ? (
          <>
            {/* Stats Dashboard */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              <div className={`border rounded-lg p-4 flex flex-col items-center ${scoreBg(avgScore)}`}>
                <ScoreRing score={avgScore} />
                <p className="text-xs text-muted-foreground mt-2">Avg Score</p>
              </div>
              <div className="border rounded-lg p-4 text-center flex flex-col justify-center">
                <p className="text-2xl font-bold">{audits.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Pages</p>
              </div>
              <div className="border rounded-lg p-4 text-center bg-red-500/10 border-red-500/20 flex flex-col justify-center">
                <p className="text-2xl font-bold text-red-400">{errorCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Errors</p>
              </div>
              <div className="border rounded-lg p-4 text-center bg-yellow-500/10 border-yellow-500/20 flex flex-col justify-center">
                <p className="text-2xl font-bold text-yellow-400">{warningCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Warnings</p>
              </div>
              <div className="border rounded-lg p-4 text-center bg-blue-500/10 border-blue-500/20 flex flex-col justify-center">
                <p className="text-2xl font-bold text-blue-400">{infoCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Info</p>
              </div>
              {/* Score Distribution */}
              <div className="border rounded-lg p-4 flex flex-col justify-center">
                <div className="flex items-end gap-1 h-10 mb-1">
                  {scoreBuckets.map((b) => (
                    <div key={b.label} className="flex-1 flex flex-col items-center">
                      <div className={`w-full rounded-t ${b.color}`} style={{ height: `${(b.count / maxBucket) * 40}px`, minHeight: b.count > 0 ? 4 : 0 }} />
                    </div>
                  ))}
                </div>
                <div className="flex gap-1 text-[9px] text-muted-foreground">
                  {scoreBuckets.map((b) => (
                    <span key={b.label} className="flex-1 text-center">{b.count}</span>
                  ))}
                </div>
                <p className="text-[9px] text-muted-foreground text-center mt-1">Score Dist.</p>
              </div>
            </div>

            {/* Result Banner */}
            {errorCount === 0 && warningCount === 0 ? (
              <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 mb-6 text-center">
                <p className="text-green-400 font-semibold text-lg">All pages pass accessibility checks!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  No errors or warnings found across {audits.length} pages. Consider manual testing with a screen reader for thorough coverage.
                </p>
              </div>
            ) : errorCount > 0 ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 mb-6 text-center">
                <p className="text-red-400 font-semibold text-lg">
                  {errorCount} error{errorCount !== 1 ? "s" : ""} and {warningCount} warning{warningCount !== 1 ? "s" : ""} found
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Expand each page below to see issues and how to fix them.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 mb-6 text-center">
                <p className="text-yellow-400 font-semibold text-lg">
                  {warningCount} warning{warningCount !== 1 ? "s" : ""} found
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  No critical errors, but some improvements are recommended.
                </p>
              </div>
            )}

            {/* Download Controls */}
            <div className="flex items-center gap-2 mb-4">
              <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as ExportFormat)}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="markdown">Markdown</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => exportAudits(audits, exportFormat)}>
                Download All ({audits.length})
              </Button>
              {filter !== "all" && sortedAudits.length > 0 && (
                <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => exportAudits(sortedAudits, exportFormat)}>
                  Download Filtered ({sortedAudits.length})
                </Button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {([
                ["all", "All"],
                ["error", "Errors"],
                ["warning", "Warnings"],
                ["info", "Info"],
              ] as [Severity, string][]).map(([key, label]) => (
                <Button
                  key={key}
                  size="sm"
                  variant={filter === key ? "default" : "outline"}
                  onClick={() => setFilter(key)}
                  className="text-xs"
                >
                  {label} ({filterCounts[key]})
                </Button>
              ))}
            </div>

            {/* Page List */}
            {sortedAudits.length === 0 ? (
              <div className="border rounded-lg p-8 text-center text-muted-foreground">
                No pages have {filter} issues.
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                {/* Table Header */}
                <div className="flex items-center gap-3 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                  <button className="w-12 text-center hover:text-foreground transition-colors" onClick={() => toggleSort("score")}>
                    Score<SortIcon active={sortKey === "score"} dir={sortDir} />
                  </button>
                  <button className="flex-1 text-left hover:text-foreground transition-colors" onClick={() => toggleSort("url")}>
                    Page URL<SortIcon active={sortKey === "url"} dir={sortDir} />
                  </button>
                  <button className="w-32 text-center hidden sm:block hover:text-foreground transition-colors" onClick={() => toggleSort("issues")}>
                    Issues<SortIcon active={sortKey === "issues"} dir={sortDir} />
                  </button>
                  <span className="w-6"></span>
                </div>
                {sortedAudits.map((audit) => {
                  const filteredIssues = filter === "all" ? audit.issues : audit.issues.filter((i) => i.severity === filter);
                  const isExpanded = expanded === audit.url;
                  const pageErrors = audit.issues.filter((i) => i.severity === "error").length;
                  const pageWarnings = audit.issues.filter((i) => i.severity === "warning").length;
                  return (
                    <div key={audit.url} className="border-b last:border-b-0">
                      <div
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setExpanded(isExpanded ? null : audit.url)}
                      >
                        <span className={`text-sm font-bold w-12 text-center ${scoreColor(audit.score)}`}>{audit.score}</span>
                        <div className="flex-1 min-w-0 flex items-center gap-1.5">
                          <a
                            href={audit.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="truncate font-mono text-xs hover:text-primary hover:underline"
                            title={audit.url}
                          >
                            {audit.url}
                          </a>
                          <button
                            onClick={(e) => { e.stopPropagation(); copyUrl(audit.url); }}
                            className="shrink-0 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Copy URL"
                          >
                            {copiedUrl === audit.url ? (
                              <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                            )}
                          </button>
                        </div>
                        <div className="w-32 hidden sm:flex gap-1.5 justify-center shrink-0">
                          {pageErrors > 0 && (
                            <Badge variant="destructive" className="text-[10px]">
                              {pageErrors} {pageErrors === 1 ? "error" : "errors"}
                            </Badge>
                          )}
                          {pageWarnings > 0 && (
                            <Badge variant="secondary" className="text-[10px]">
                              {pageWarnings} {pageWarnings === 1 ? "warn" : "warns"}
                            </Badge>
                          )}
                          {pageErrors === 0 && pageWarnings === 0 && (
                            <Badge variant="outline" className="text-[10px] text-green-400 border-green-500/30">
                              Pass
                            </Badge>
                          )}
                        </div>
                        <span className="text-muted-foreground text-xs w-6 text-center shrink-0">{isExpanded ? "▲" : "▼"}</span>
                      </div>
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-1 space-y-2 bg-muted/10">
                          {filteredIssues.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-3">
                              No {filter} issues on this page.
                            </p>
                          ) : (
                            filteredIssues.map((issue, i) => (
                              <div key={i} className="border rounded-lg p-3 text-sm bg-background">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge
                                    variant={issue.severity === "error" ? "destructive" : issue.severity === "warning" ? "secondary" : "outline"}
                                    className="text-[10px]"
                                  >
                                    {issue.severity.toUpperCase()}
                                  </Badge>
                                  <span className="font-mono text-xs text-muted-foreground">{issue.rule}</span>
                                </div>
                                <p className="font-medium">{issue.message}</p>
                                <p className="text-xs text-muted-foreground mt-1">{issue.suggestion}</p>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <svg
              height={64}
              width={64}
              viewBox="0 0 36 34"
              xmlSpace="preserve"
              xmlns="http://www.w3.org/2000/svg"
              className="fill-[#3bde77] opacity-30"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M9.13883 7.06589V0.164429L13.0938 0.164429V6.175L14.5178 7.4346C15.577 6.68656 16.7337 6.27495 17.945 6.27495C19.1731 6.27495 20.3451 6.69807 21.4163 7.46593L22.8757 6.175V0.164429L26.8307 0.164429V7.06589V7.95679L26.1634 8.54706L24.0775 10.3922C24.3436 10.8108 24.5958 11.2563 24.8327 11.7262L26.0467 11.4215L28.6971 8.08749L31.793 10.5487L28.7257 14.407L28.3089 14.9313L27.6592 15.0944L26.2418 15.4502C26.3124 15.7082 26.3793 15.9701 26.4422 16.2355L28.653 16.6566L29.092 16.7402L29.4524 17.0045L35.3849 21.355L33.0461 24.5444L27.474 20.4581L27.0719 20.3816C27.1214 21.0613 27.147 21.7543 27.147 22.4577C27.147 22.5398 27.1466 22.6214 27.1459 22.7024L29.5889 23.7911L30.3219 24.1177L30.62 24.8629L33.6873 32.5312L30.0152 34L27.246 27.0769L26.7298 26.8469C25.5612 32.2432 22.0701 33.8808 17.945 33.8808C13.8382 33.8808 10.3598 32.2577 9.17593 26.9185L8.82034 27.0769L6.05109 34L2.37897 32.5312L5.44629 24.8629L5.74435 24.1177L6.47743 23.7911L8.74487 22.7806C8.74366 22.6739 8.74305 22.5663 8.74305 22.4577C8.74305 21.7616 8.76804 21.0758 8.81654 20.4028L8.52606 20.4581L2.95395 24.5444L0.615112 21.355L6.54761 17.0045L6.908 16.7402L7.34701 16.6566L9.44264 16.2575C9.50917 15.9756 9.5801 15.6978 9.65528 15.4242L8.34123 15.0944L7.69155 14.9313L7.27471 14.407L4.20739 10.5487L7.30328 8.08749L9.95376 11.4215L11.0697 11.7016C11.3115 11.2239 11.5692 10.7716 11.8412 10.3473L9.80612 8.54706L9.13883 7.95679V7.06589Z"
              ></path>
            </svg>
            <h2 className="text-xl font-semibold text-muted-foreground">
              Spider A11y Checker
            </h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Enter a website URL above to crawl and audit for accessibility issues.
              Spider will check for WCAG violations including missing alt text,
              heading order, ARIA landmarks, form labels, and more.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
