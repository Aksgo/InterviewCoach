import React from "react";
import { Activity, ShieldCheck, RefreshCw, X, CheckCircle2, Mic, Sparkles } from "lucide-react";
import { useAIStatus } from "../context/AIStatusContext";

export default function AIStatusModal() {
  const {
    isModalOpen,
    setIsModalOpen,
    isProcessing,
    currentTask,
    lastActionTime,
    totalAICalls,
    fetchServerStatus,
  } = useAIStatus();

  if (!isModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in no-print">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 max-w-md w-full overflow-hidden animate-slide-up">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between relative">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center p-1">
              <img src="/nativelyai.svg" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">AI Agent Status</h3>
              <p className="text-xs text-slate-300 flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full inline-block bg-emerald-400 animate-ping" />
                <span>AI Agent Live & Operational</span>
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
              : "bg-emerald-50/80 border-emerald-200/80 text-emerald-950"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isProcessing ? (
                  <Activity className="w-5 h-5 text-blue-600 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                )}
                <span className="font-semibold text-sm">
                  {isProcessing ? "AI Agent Processing Request..." : "AI Agent Ready & Operational"}
                </span>
              </div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                isProcessing ? "bg-blue-200 text-blue-800" : "bg-emerald-200 text-emerald-800"
              }`}>
                {isProcessing ? "BUSY" : "AGENT LIVE"}
              </span>
            </div>

            <p className="text-xs mt-2 font-medium leading-relaxed">
              {isProcessing
                ? currentTask || "Executing interview task..."
                : "The AI interviewer agent is online and ready to conduct live mock interviews, analyze candidate responses, synthesize speech, and generate scorecards."}
            </p>

            {lastActionTime && (
              <p className="text-[11px] opacity-75 mt-2 pt-2 border-t border-slate-200/60">
                Last Activity: <span className="font-semibold">{lastActionTime}</span>
              </p>
            )}
          </div>

          {/* Core Capabilities & Specs */}
          <div className="space-y-2 text-xs pt-1">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-slate-800">Adaptive Mock Interviews</p>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  Generates realistic technical and behavioral interview questions tailored to candidate roles and companies.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
              <Mic className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-slate-800">Live Audio & Speech Synthesis</p>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  Delivers realistic natural voice audio during mock interview calls with real-time text synchronization.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-slate-800">Privacy & Data Protection</p>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  Resumes and voice audio are processed strictly in-memory during scoring and never retained.
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
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Agent Availability</p>
              <p className="text-sm font-bold text-emerald-600 mt-1">100% Operational</p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between">
          <button
            onClick={() => fetchServerStatus()}
            className="text-xs text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" /> Refresh Status
          </button>
          <button
            onClick={() => setIsModalOpen(false)}
            className="btn-primary text-xs py-1.5 px-4 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
