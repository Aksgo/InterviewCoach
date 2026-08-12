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
        <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <img
            src="/nativelyai.svg"
            alt="Interview Coach Logo"
            className="w-9 h-9 object-contain shrink-0"
          />
          <span className="font-heading font-bold text-lg text-foreground tracking-tight">
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
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 cursor-pointer shadow-xs ${
              isProcessing
                ? "bg-blue-100/90 text-blue-950 border-blue-300 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-800 animate-pulse"
                : "bg-emerald-100/90 text-emerald-950 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800 hover:bg-emerald-200/80 hover:border-emerald-400 dark:hover:bg-emerald-900/60"
            }`}
            title="Click to view AI Agent status"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 text-blue-700 dark:text-blue-300 animate-spin" />
                <span className="hidden sm:inline font-bold">AI Agent:</span>
                <span className="max-w-[120px] sm:max-w-[160px] truncate">
                  {currentTask || "Active"}
                </span>
              </>
            ) : (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600 dark:bg-emerald-400"></span>
                </span>
                <span className="text-emerald-950 dark:text-emerald-200 font-semibold">
                  AI Agent: <strong className="text-emerald-700 dark:text-emerald-400 font-extrabold">Live</strong>
                </span>
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