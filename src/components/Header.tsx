import { Link, useLocation } from "react-router-dom";
import { Sparkles, Loader2, Cpu, AlertTriangle, Sun, Moon } from "lucide-react";
import { useAIStatus } from "../context/AIStatusContext";
import { useTheme } from "../context/ThemeContext";

export default function Header() {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const { isProcessing, currentTask, isQuotaExceeded, setIsModalOpen } = useAIStatus();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 bg-card/90 backdrop-blur-md border-b border-border/80 no-print transition-colors duration-200">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-heading font-bold text-lg text-foreground">
            Interview Coach
          </span>
        </Link>

        <nav className="flex items-center gap-3">
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-lg border border-border/60 flex items-center justify-center hover:bg-muted/80 text-foreground/75 hover:text-foreground transition-all cursor-pointer"
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? (
              <Moon className="w-4 h-4" />
            ) : (
              <Sun className="w-4 h-4 text-amber-400" />
            )}
          </button>

          {/* AI Active Status Button */}
          <button
            onClick={() => setIsModalOpen(true)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 cursor-pointer ${
              isProcessing
                ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900 shadow-sm animate-pulse"
                : isQuotaExceeded
                ? "bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900 hover:bg-amber-100/90 dark:hover:bg-amber-950/60"
                : "bg-emerald-50/80 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/60 hover:bg-emerald-100/80 hover:border-emerald-300 dark:hover:bg-emerald-950/50"
            }`}
            title="Click to view AI Engine Status, models, and real-time activity"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                <span className="hidden sm:inline font-bold">AI Active:</span>
                <span className="max-w-[120px] sm:max-w-[160px] truncate">
                  {currentTask || "Processing..."}
                </span>
              </>
            ) : isQuotaExceeded ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                <span>AI Status: <strong className="text-amber-950 font-bold">Rate Limited (Local Mode)</strong></span>
              </>
            ) : (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <Cpu className="w-3.5 h-3.5 text-emerald-600" />
                <span>AI Status: <strong className="text-emerald-900">Gemini Live</strong></span>
              </>
            )}
          </button>

          {!isHome && (
            <Link to="/" className="btn-ghost text-sm">
              Home
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}