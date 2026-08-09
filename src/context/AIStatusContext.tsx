import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { subscribeAIStatus } from "../utils/api";

export interface ModelDetail {
  id: string;
  name: string;
  status: string;
  isRateLimited: boolean;
}

interface AIStatusContextType {
  isProcessing: boolean;
  currentTask: string | null;
  lastSource: string | null;
  lastActionTime: string | null;
  totalAICalls: number;
  isModalOpen: boolean;
  isQuotaExceeded: boolean;
  setIsModalOpen: (open: boolean) => void;
  startAITask: (taskName: string) => void;
  endAITask: (source?: string) => void;
  serverStatus: {
    hasApiKey: boolean;
    provider: string;
    activeEngine: string;
    isQuotaExceeded: boolean;
    models: ModelDetail[];
    groundingEnabled: boolean;
    rateLimitHandling: string;
    lastQuotaExceededAt: string | null;
  } | null;
  fetchServerStatus: () => Promise<void>;
}

const AIStatusContext = createContext<AIStatusContextType | undefined>(undefined);

export const AIStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTask, setCurrentTask] = useState<string | null>(null);
  const [lastSource, setLastSource] = useState<string | null>("Gemini 2.5 Flash");
  const [lastActionTime, setLastActionTime] = useState<string | null>(null);
  const [totalAICalls, setTotalAICalls] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [serverStatus, setServerStatus] = useState<AIStatusContextType["serverStatus"]>(null);

  const fetchServerStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-status");
      if (res.ok) {
        const data = await res.json();
        const quotaHit = !!data.isQuotaExceeded;
        setIsQuotaExceeded(quotaHit);
        setServerStatus({
          hasApiKey: data.hasApiKey,
          provider: data.provider || "Google Gemini AI",
          activeEngine: data.activeEngine || "Google Gemini 2.5 Flash",
          isQuotaExceeded: quotaHit,
          models: Array.isArray(data.models)
            ? data.models
            : [
                { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", status: quotaHit ? "429 Rate Limited" : "Active", isRateLimited: quotaHit },
                { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", status: quotaHit ? "429 Rate Limited" : "Active", isRateLimited: quotaHit },
                { id: "local-fallback", name: "Local Intelligence Engine", status: "100% Operational", isRateLimited: false },
              ],
          groundingEnabled: !!data.groundingEnabled,
          rateLimitHandling: data.rateLimitHandling || "Automatic Failover",
          lastQuotaExceededAt: data.lastQuotaExceededAt || null,
        });
      }
    } catch (err) {
      console.warn("Failed to fetch AI status:", err);
    }
  }, []);

  useEffect(() => {
    fetchServerStatus();
    const unsubscribe = subscribeAIStatus((busy, actionName, source) => {
      setIsProcessing(busy);
      if (busy) {
        if (actionName) setCurrentTask(actionName);
        setLastActionTime(new Date().toLocaleTimeString());
        setTotalAICalls((prev) => prev + 1);
      } else {
        setCurrentTask(null);
        if (source) {
          setLastSource(source);
          if (source.includes("fallback") || source.includes("local")) {
            setIsQuotaExceeded(true);
          }
        }
        setLastActionTime(new Date().toLocaleTimeString());
        fetchServerStatus();
      }
    });
    return unsubscribe;
  }, [fetchServerStatus]);

  const startAITask = useCallback((taskName: string) => {
    setIsProcessing(true);
    setCurrentTask(taskName);
    setLastActionTime(new Date().toLocaleTimeString());
    setTotalAICalls((prev) => prev + 1);
  }, []);

  const endAITask = useCallback((source?: string) => {
    setIsProcessing(false);
    setCurrentTask(null);
    if (source) {
      setLastSource(source);
    }
    setLastActionTime(new Date().toLocaleTimeString());
  }, []);

  return (
    <AIStatusContext.Provider
      value={{
        isProcessing,
        currentTask,
        lastSource,
        lastActionTime,
        totalAICalls,
        isModalOpen,
        isQuotaExceeded,
        setIsModalOpen,
        startAITask,
        endAITask,
        serverStatus,
        fetchServerStatus,
      }}
    >
      {children}
    </AIStatusContext.Provider>
  );
};

export function useAIStatus() {
  const context = useContext(AIStatusContext);
  if (!context) {
    throw new Error("useAIStatus must be used within an AIStatusProvider");
  }
  return context;
}
