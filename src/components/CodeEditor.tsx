import React, { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { Code2, Copy, Check, RotateCcw, Sparkles, Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

interface CodeEditorProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}

const LANGUAGES = [
  { label: "JavaScript", value: "javascript" },
  { label: "TypeScript", value: "typescript" },
  { label: "Python", value: "python" },
  { label: "Java", value: "java" },
  { label: "C++", value: "cpp" },
  { label: "Go", value: "go" },
  { label: "SQL", value: "sql" },
  { label: "HTML", value: "html" },
  { label: "CSS", value: "css" },
  { label: "JSON", value: "json" },
];

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const { theme } = useTheme();
  
  // Track system/app dark mode
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof document !== "undefined") {
      return theme === "dark" || document.documentElement.classList.contains("dark");
    }
    return true;
  });

  useEffect(() => {
    const isDark = theme === "dark" || (typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
    setIsDarkMode(isDark);
  }, [theme]);

  const [language, setLanguage] = useState("javascript");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    if (disabled) return;
    onChange("// Write your code here...\n");
  };

  const toggleEditorTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  return (
    <div className="w-full rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-muted/80 border-b border-border text-xs">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 font-semibold text-foreground/80">
            <Code2 className="w-4 h-4 text-primary" />
            <span className="hidden sm:inline">Code Sandbox</span>
          </div>

          {/* Language Selector */}
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={disabled}
            className="px-2 py-1 rounded-md bg-background border border-border text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Dark / Light Mode Toggle Button */}
          <button
            type="button"
            onClick={toggleEditorTheme}
            className="p-1.5 rounded-md hover:bg-background text-foreground/70 hover:text-foreground transition-colors text-xs flex items-center gap-1"
            title={isDarkMode ? "Switch Editor to Light Mode" : "Switch Editor to Dark Mode"}
          >
            {isDarkMode ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-indigo-500" />
            )}
            <span className="hidden md:inline font-medium">{isDarkMode ? "Dark" : "Light"}</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            disabled={!value}
            className="p-1.5 rounded-md hover:bg-background text-foreground/70 hover:text-foreground transition-colors disabled:opacity-40 text-xs flex items-center gap-1"
            title="Copy Code"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-500 font-medium hidden sm:inline">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Copy</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={disabled || !value}
            className="p-1.5 rounded-md hover:bg-background text-foreground/70 hover:text-foreground transition-colors disabled:opacity-40 text-xs flex items-center gap-1"
            title="Clear Editor"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* Monaco Editor Container */}
      <div className="h-64 w-full relative">
        <Editor
          height="100%"
          language={language}
          value={value}
          theme={isDarkMode ? "vs-dark" : "light"}
          onChange={(val) => onChange(val || "")}
          options={{
            readOnly: disabled,
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: "on",
            padding: { top: 10, bottom: 10 },
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
            formatOnType: true,
            formatOnPaste: true,
            bracketPairColorization: { enabled: true },
            suggest: {
              showKeywords: true,
              showSnippets: true,
            },
          }}
          loading={
            <div className="h-full w-full flex items-center justify-center bg-card text-muted-foreground text-xs gap-2">
              <Sparkles className="w-4 h-4 animate-spin text-primary" />
              <span>Loading Monaco Code Editor...</span>
            </div>
          }
        />
      </div>
    </div>
  );
};

export default CodeEditor;
