"use client";

import { useState } from "react";
import SearchBar from "./searchbar";
import { Badge } from "@/components/ui/badge";

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

  // Missing lang attribute
  if (!/<html[^>]*lang=/i.test(html)) {
    issues.push({ rule: "html-lang", severity: "error", message: "Missing lang attribute on <html>", suggestion: 'Add lang="en" to the <html> tag' });
    score -= 10;
  }

  // Images without alt
  const noAltImgs = (html.match(/<img(?![^>]*alt=)[^>]*>/gi) || []).length;
  if (noAltImgs > 0) {
    issues.push({ rule: "img-alt", severity: "error", message: `${noAltImgs} image(s) missing alt attribute`, suggestion: "Add descriptive alt text to all images" });
    score -= Math.min(20, noAltImgs * 5);
  }

  // Multiple H1s
  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
  if (h1Count > 1) {
    issues.push({ rule: "single-h1", severity: "warning", message: `${h1Count} H1 tags found`, suggestion: "Use only one H1 per page" });
    score -= 5;
  } else if (h1Count === 0) {
    issues.push({ rule: "single-h1", severity: "warning", message: "No H1 tag found", suggestion: "Add a single H1 heading" });
    score -= 5;
  }

  // Skipped heading levels
  const headingLevels = (html.match(/<h([1-6])[\s>]/gi) || []).map((m) => parseInt(m[2]));
  for (let i = 1; i < headingLevels.length; i++) {
    if (headingLevels[i] - headingLevels[i - 1] > 1) {
      issues.push({ rule: "heading-order", severity: "warning", message: `Heading level skipped: H${headingLevels[i - 1]} to H${headingLevels[i]}`, suggestion: "Use sequential heading levels" });
      score -= 5;
      break;
    }
  }

  // Empty links
  const emptyLinks = (html.match(/<a[^>]*>\s*<\/a>/gi) || []).length;
  if (emptyLinks > 0) {
    issues.push({ rule: "empty-links", severity: "error", message: `${emptyLinks} empty link(s) found`, suggestion: "Add text content or aria-label to links" });
    score -= Math.min(10, emptyLinks * 3);
  }

  // Missing form labels
  const inputs = (html.match(/<input[^>]*type=["'](?:text|email|password|tel|number|search)["'][^>]*>/gi) || []).length;
  const labels = (html.match(/<label/gi) || []).length;
  if (inputs > labels) {
    issues.push({ rule: "form-labels", severity: "error", message: `${inputs - labels} input(s) potentially missing labels`, suggestion: "Associate a <label> with each form input" });
    score -= Math.min(15, (inputs - labels) * 5);
  }

  // Missing ARIA landmarks
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

  if (issues.length === 0) {
    issues.push({ rule: "all-clear", severity: "info", message: "No accessibility issues detected", suggestion: "Consider manual testing with a screen reader" });
  }

  return { url, score: Math.max(0, score), issues };
}

export default function Checker() {
  const [data, setData] = useState<any[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "error" | "warning" | "info">("all");

  const audits = (data || []).filter((p) => p?.url && p?.content).map((p) => checkA11y(p.url, p.content));
  const avgScore = audits.length ? Math.round(audits.reduce((s, a) => s + a.score, 0) / audits.length) : 0;
  const totalErrors = audits.reduce((s, a) => s + a.issues.filter((i) => i.severity === "error").length, 0);
  const totalWarnings = audits.reduce((s, a) => s + a.issues.filter((i) => i.severity === "warning").length, 0);

  return (
    <div className="flex flex-col h-screen">
      <SearchBar setDataValues={setData} />
      <div className="flex-1 overflow-auto p-4">
        {audits.length > 0 && (
          <>
            <div className="flex items-center gap-6 mb-6">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold border-4 ${avgScore >= 80 ? "border-green-500 text-green-500" : avgScore >= 50 ? "border-yellow-500 text-yellow-500" : "border-red-500 text-red-500"}`}>
                {avgScore}
              </div>
              <div className="flex gap-6">
                <div className="text-center"><p className="text-xl font-bold text-red-500">{totalErrors}</p><p className="text-xs text-muted-foreground">Errors</p></div>
                <div className="text-center"><p className="text-xl font-bold text-yellow-500">{totalWarnings}</p><p className="text-xs text-muted-foreground">Warnings</p></div>
                <div className="text-center"><p className="text-xl font-bold">{audits.length}</p><p className="text-xs text-muted-foreground">Pages</p></div>
              </div>
            </div>
            <div className="flex gap-2 mb-4">
              {(["all", "error", "warning", "info"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded text-xs capitalize ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{f}</button>
              ))}
            </div>
            <div className="border rounded-lg">
              {audits.map((audit) => (
                <div key={audit.url} className="border-b last:border-b-0">
                  <button className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 text-left" onClick={() => setExpanded(expanded === audit.url ? null : audit.url)}>
                    <span className={`text-sm font-bold ${audit.score >= 80 ? "text-green-500" : audit.score >= 50 ? "text-yellow-500" : "text-red-500"}`}>{audit.score}</span>
                    <span className="flex-1 truncate text-sm">{audit.url}</span>
                  </button>
                  {expanded === audit.url && (
                    <div className="px-6 pb-3 space-y-2">
                      {audit.issues.filter((i) => filter === "all" || i.severity === filter).map((issue, i) => (
                        <div key={i} className="border rounded p-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Badge variant={issue.severity === "error" ? "destructive" : issue.severity === "warning" ? "secondary" : "outline"} className="text-xs">{issue.severity}</Badge>
                            <span className="font-medium">{issue.rule}</span>
                          </div>
                          <p className="mt-1">{issue.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">Fix: {issue.suggestion}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
        {!data && <div className="flex items-center justify-center h-full text-muted-foreground">Enter a URL to audit accessibility</div>}
      </div>
    </div>
  );
}
