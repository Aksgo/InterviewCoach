import type { InterviewSession } from "./storage";

export function downloadResultsAsPDF(session: InterviewSession): void {
  const { scores, resumeScore, role, company, questions, createdAt } = session;
  if (!scores) return;

  const date = new Date(createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Build HTML for resume match if present
  let resumeScoreHtml = "";
  if (resumeScore) {
    resumeScoreHtml = `
      <div style="background:#F0F9FF; border:1px solid #BAE6FD; border-radius:10px; padding:16px; margin-bottom:24px;">
        <h3 style="margin:0 0 8px 0; color:#0369A1; font-size:16px;">Resume Match Score: ${resumeScore.overallScore}% (${escapeHtml(resumeScore.matchLevel)})</h3>
        <p style="margin:0 0 12px 0; font-size:13px; color:#334155;">${escapeHtml(resumeScore.summary)}</p>
        
        ${
          resumeScore.strengths && resumeScore.strengths.length > 0
            ? `<div style="margin-bottom:8px;"><strong>Matching Strengths:</strong><ul style="margin:4px 0; padding-left:20px;">${resumeScore.strengths.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul></div>`
            : ""
        }
        ${
          resumeScore.gaps && resumeScore.gaps.length > 0
            ? `<div style="margin-bottom:8px;"><strong>Missing Keywords / Skill Gaps:</strong><ul style="margin:4px 0; padding-left:20px;">${resumeScore.gaps.map((g) => `<li>${escapeHtml(g)}</li>`).join("")}</ul></div>`
            : ""
        }
        ${
          resumeScore.recommendations && resumeScore.recommendations.length > 0
            ? `<div><strong>Recommendations:</strong><ul style="margin:4px 0; padding-left:20px;">${resumeScore.recommendations.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul></div>`
            : ""
        }
      </div>
    `;
  }

  // Build an HTML document for printing
  const lines = questions.map(
    (q, i) =>
      `<div style="margin-bottom:16px;">
        <strong style="color:#0F766E;">Q${i + 1}:</strong> ${escapeHtml(q.text)}
        <br/>
        <strong style="color:#134E4A;">Your Answer:</strong> ${escapeHtml(q.answerTranscript || "No answer recorded")}
        <br/>
        <strong style="color:#134E4A;">Score:</strong> ${q.score ?? "—"}/10
        ${q.feedback ? `<br/><em style="color:#555;">${escapeHtml(q.feedback)}</em>` : ""}
      </div>`
  ).join("");

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>Interview Results — ${escapeHtml(role)} at ${escapeHtml(company)}</title>
<style>
  body { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #134E4A; }
  h1 { color: #0369A1; font-size: 26px; margin-bottom: 4px; }
  .meta { color: #555; font-size: 14px; margin-bottom: 24px; }
  .score-grid { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 28px; }
  .score-card { background: #F0FDFA; border: 1px solid #99F6E4; border-radius: 10px; padding: 16px 20px; text-align: center; flex: 1; min-width: 100px; }
  .score-card .val { font-size: 28px; font-weight: 700; color: #0F766E; }
  .score-card .lbl { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #555; margin-top: 4px; }
  hr { border: none; border-top: 1px solid #E2E8F0; margin: 24px 0; }
  .summary { background: #F8FAFC; border-left: 4px solid #0369A1; padding: 16px; border-radius: 6px; margin-bottom: 24px; }
</style>
</head><body>
  <h1>Interview &amp; Resume Results Report</h1>
  <div class="meta">
    <strong>Role:</strong> ${escapeHtml(role)} at ${escapeHtml(company)} &bull; ${date}
  </div>

  ${resumeScoreHtml}

  <h2>Interview Delivery Scores</h2>
  <div class="score-grid">
    <div class="score-card"><div class="val">${scores.relevance}/10</div><div class="lbl">Relevance</div></div>
    <div class="score-card"><div class="val">${scores.clarity}/10</div><div class="lbl">Clarity</div></div>
    <div class="score-card"><div class="val">${scores.depth}/10</div><div class="lbl">Depth</div></div>
    <div class="score-card"><div class="val">${scores.confidence}/10</div><div class="lbl">Confidence</div></div>
    <div class="score-card"><div class="val">${scores.overall}/10</div><div class="lbl">Overall</div></div>
  </div>
  ${scores.summary ? `<div class="summary"><strong>Summary:</strong><br/>${escapeHtml(scores.summary)}</div>` : ""}
  <hr/>
  <h2>Questions &amp; Answers</h2>
  ${lines}
</body></html>`;

  // Open a new window and print
  const win = window.open("", "_blank");
  if (!win) {
    // Fallback: download as blob
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `interview-results-${role.replace(/\s+/g, "-")}.html`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}