import { Link, useLocation } from "react-router-dom";
import { Sparkles } from "lucide-react";

export default function Header() {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-border/30 no-print">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-heading font-bold text-lg text-foreground">
            Interview Coach
          </span>
        </Link>

        <nav className="flex items-center gap-2">
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