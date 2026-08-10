import React, { useState, useEffect, useRef } from "react";
import { Mic, CheckCircle2, AlertCircle, RefreshCw, Volume2, ShieldCheck } from "lucide-react";

interface MicCheckProps {
  onVerified?: (verified: boolean) => void;
  autoConnect?: boolean;
}

export const MicCheck: React.FC<MicCheckProps> = ({ onVerified, autoConnect = false }) => {
  const [status, setStatus] = useState<"idle" | "testing" | "connected" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [volumeLevel, setVolumeLevel] = useState<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const cleanupAudio = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setVolumeLevel(0);
  };

  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, []);

  const testMicrophone = async () => {
    cleanupAudio();
    setStatus("testing");
    setErrorMsg("");

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone API not supported in this browser environment.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up web audio API volume meter
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateMeter = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          // Scale 0 - 100
          const level = Math.min(100, Math.round((average / 128) * 100));
          setVolumeLevel(level);
          animFrameRef.current = requestAnimationFrame(updateMeter);
        };

        updateMeter();
      }

      setStatus("connected");
      if (onVerified) onVerified(true);
    } catch (err: any) {
      console.warn("Microphone connection check failed:", err);
      setStatus("error");
      const msg =
        err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError"
          ? "Microphone access blocked. Please allow mic permission in your browser address bar."
          : err?.message || "Failed to access microphone. Please check your mic connection.";
      setErrorMsg(msg);
      if (onVerified) onVerified(false);
    }
  };

  useEffect(() => {
    if (autoConnect) {
      testMicrophone();
    }
  }, [autoConnect]);

  return (
    <div className="w-full rounded-xl border border-border bg-muted/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              status === "connected"
                ? "bg-emerald-500/10 text-emerald-500"
                : status === "error"
                ? "bg-rose-500/10 text-rose-500"
                : "bg-primary/10 text-primary"
            }`}
          >
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <span>Microphone Connection Check</span>
              {status === "connected" && (
                <span className="text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Verified ✓
                </span>
              )}
            </h4>
            <p className="text-[11px] text-foreground/60">
              {status === "connected"
                ? "Microphone is connected and active. Say something to test level."
                : status === "testing"
                ? "Connecting to microphone..."
                : status === "error"
                ? "Microphone permission or connection issue."
                : "Connect and test audio permission before starting interview."}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={testMicrophone}
          disabled={status === "testing"}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
            status === "connected"
              ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
              : status === "error"
              ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30"
              : "bg-primary hover:bg-primary/90 text-white shadow-xs"
          }`}
        >
          {status === "testing" ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Testing...</span>
            </>
          ) : status === "connected" ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Re-Test Mic</span>
            </>
          ) : status === "error" ? (
            <>
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Permission</span>
            </>
          ) : (
            <>
              <Mic className="w-3.5 h-3.5" />
              <span>Connect Mic</span>
            </>
          )}
        </button>
      </div>

      {/* Connected audio visualizer meter */}
      {status === "connected" && (
        <div className="pt-2 border-t border-border/60 flex items-center gap-3">
          <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 shrink-0">
            <Volume2 className="w-3.5 h-3.5 animate-pulse" />
            <span>Voice Signal:</span>
          </div>
          <div className="flex-1 bg-card h-2.5 rounded-full overflow-hidden border border-border/80 flex items-center px-0.5">
            <div
              className="h-1.5 rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-primary transition-all duration-75"
              style={{ width: `${Math.max(6, volumeLevel)}%` }}
            />
          </div>
          <span className="text-[10px] font-mono font-semibold text-foreground/50 shrink-0">
            {volumeLevel > 10 ? "Speaking..." : "Silent"}
          </span>
        </div>
      )}

      {/* Error Message */}
      {status === "error" && errorMsg && (
        <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-500 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
};

export default MicCheck;
