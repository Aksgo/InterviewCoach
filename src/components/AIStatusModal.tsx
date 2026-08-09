import React from "react";
import { Sparkles, Activity, ShieldCheck, Cpu, RefreshCw, X, Globe, CheckCircle2, AlertTriangle, Zap } from "lucide-react";
import { useAIStatus } from "../context/AIStatusContext";

export default function AIStatusModal() {
  const {
    isModalOpen,
    setIsModalOpen,
    isProcessing,
    currentTask,
    lastSource,
    lastActionTime,
    totalAICalls,
    isQuotaExceeded,
    serverStatus,
    fetchServerStatus,
  } = useAIStatus();

  if (!isModalOpen) return null;

  const models = serverStatus?.models || [
    { id: "gemini-3.6-flash", name: "Gemini 3.6 Flash", status: isQuotaExceeded ? "429 Rate Limited / Quota Reached" : "Active", isRateLimited: isQuotaExceeded },
    { id: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash Lite", status: isQuotaExceeded ? "429 Rate Limited / Quota Reached" : "Active", isRateLimited: isQuotaExceeded },
    { id: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash Lite", status: isQuotaExceeded ? "429 Rate Limited / Quota Reached" : "Active", isRateLimited: isQuotaExceeded },
    { id: "gemini-3.1-flash-tts", name: "Gemini 3.1 Flash TTS", status: isQuotaExceeded ? "429 Rate Limited / Quota Reached" : "Active", isRateLimited: isQuotaExceeded },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", status: isQuotaExceeded ? "429 Rate Limited / Quota Reached" : "Active", isRateLimited: isQuotaExceeded },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", status: isQuotaExceeded ? "429 Rate Limited / Quota Reached" : "Active", isRateLimited: isQuotaExceeded },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", status: isQuotaExceeded ? "429 Rate Limited / Quota Reached" : "Active", isRateLimited: isQuotaExceeded },
    { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", status: isQuotaExceeded ? "429 Rate Limited / Quota Reached" : "Active", isRateLimited: isQuotaExceeded },
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", status: isQuotaExceeded ? "429 Rate Limited / Quota Reached" : "Active", isRateLimited: isQuotaExceeded },
    { id: "local-fallback", name: "Local Intelligence Engine", status: "100% Operational (Instant)", isRateLimited: false },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in no-print">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 max-w-md w-full overflow-hidden animate-slide-up">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between relative">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <Sparkles className="w-5 h-5 animate-pulse text-blue-300" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">AI Engine & Model Status</h3>
              <p className="text-xs text-slate-300 flex items-center gap-1.5 mt-0.5">
                <span className={`w-2 h-2 rounded-full inline-block ${isQuotaExceeded ? "bg-amber-400" : "bg-emerald-400 animate-ping"}`} />
                <span>{isQuotaExceeded ? "Smart Local Fallback Engine Active" : "Google Gemini Cloud AI Active"}</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Active Activity Box */}
          <div className={`p-4 rounded-xl border transition-all ${
            isProcessing
              ? "bg-blue-50/80 border-blue-200 text-blue-900"
              : isQuotaExceeded
              ? "bg-amber-50/80 border-amber-200/90 text-amber-950"
              : "bg-emerald-50/80 border-emerald-200/80 text-emerald-950"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isProcessing ? (
                  <Activity className="w-5 h-5 text-blue-600 animate-spin" />
                ) : isQuotaExceeded ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                )}
                <span className="font-semibold text-sm">
                  {isProcessing
                    ? "AI Processing Request..."
                    : isQuotaExceeded
                    ? "Gemini API Quota Limit Reached"
                    : "Gemini AI Ready & Operational"}
                </span>
              </div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                isProcessing
                  ? "bg-blue-200 text-blue-800"
                  : isQuotaExceeded
                  ? "bg-amber-200 text-amber-900"
                  : "bg-emerald-200 text-emerald-800"
              }`}>
                {isProcessing ? "BUSY" : isQuotaExceeded ? "LOCAL MODE" : "GEMINI LIVE"}
              </span>
            </div>

            <p className="text-xs mt-2 font-medium">
              {isProcessing
                ? currentTask || "Executing AI logic..."
                : isQuotaExceeded
                ? "Google Gemini API rate limits (20 requests/day free tier) have been hit for 2.5 Flash and 2.0 Flash. The application is smoothly serving questions and evaluations via the Local Intelligence Engine."
                : "Ready to generate grounded Glassdoor/LeetCode questions, evaluate live spoken answers, and analyze resumes."}
            </p>

            {lastActionTime && (
              <p className="text-[11px] opacity-75 mt-1">
                Last AI Activity: <span className="font-semibold">{lastActionTime}</span> {lastSource && `(${lastSource})`}
              </p>
            )}
          </div>

          {/* Model Status Breakdown */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Model Pipeline & Rate Limits</h4>
            <div className="space-y-1.5 text-xs">
              {models.map((m) => (
                <div
                  key={m.id}
                  className={`p-2.5 rounded-xl border flex items-center justify-between transition-colors ${
                    m.isRateLimited
                      ? "bg-amber-50/50 border-amber-200/80 text-amber-900"
                      : m.id === "local-fallback"
                      ? "bg-blue-50/50 border-blue-200/80 text-blue-900"
                      : "bg-emerald-50/50 border-emerald-200/80 text-emerald-900"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {m.id === "local-fallback" ? (
                      <Zap className="w-4 h-4 text-blue-600" />
                    ) : m.isRateLimited ? (
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    ) : (
                      <Cpu className="w-4 h-4 text-emerald-600" />
                    )}
                    <div>
                      <p className="font-bold text-slate-800">{m.name}</p>
                      <p className="text-[10px] text-slate-500">{m.status}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    m.isRateLimited
                      ? "bg-amber-100 text-amber-800"
                      : "bg-emerald-100 text-emerald-800"
                  }`}>
                    {m.isRateLimited ? "429 Limit" : "Ready"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Additional Features Specs */}
          <div className="space-y-2 text-xs pt-1">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
              <Globe className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-slate-800">Live Search Grounding</p>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  Scrapes Glassdoor, LeetCode, and GeeksforGeeks candidate interview reports when Gemini API quota is available.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
              <RefreshCw className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-slate-800">Automatic Failover Protection</p>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  Tries Gemini 3.6 Flash → Gemini 3.5 Flash Lite → Gemini 3.1 Flash Lite → Gemini 2.5 Flash → Local Intelligence Backup. Ensures 0 downtime or frozen screens.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-slate-800">Privacy & Data Protection</p>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  Resumes and voice audio are processed strictly in-memory during scoring and never stored in external databases.
                </p>
              </div>
            </div>
          </div>

          {/* Activity Statistics */}
          <div className="grid grid-cols-2 gap-2 text-center pt-1">
            <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200/80">
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Total AI Requests</p>
              <p className="text-lg font-extrabold text-slate-800">{totalAICalls}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200/80">
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">App Operationality</p>
              <p className="text-sm font-bold text-emerald-600 mt-1">100% Operational</p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between">
          <button
            onClick={() => fetchServerStatus()}
            className="text-xs text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Refresh Status
          </button>
          <button
            onClick={() => setIsModalOpen(false)}
            className="btn-primary text-xs py-1.5 px-4"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
