import { Mic, StopCircle, Loader2, AlertCircle, RefreshCw, Volume2 } from "lucide-react";
import { useRef, useState, useCallback, useEffect } from "react";
import { getSpeechmaticsToken } from "../utils/api";

interface AudioRecorderProps {
  isRecording: boolean;
  currentText?: string;
  onTranscript: (text: string) => void;
  onRecordingChange: (recording: boolean) => void;
  disabled?: boolean;
  autoStart?: boolean;
}

type MicState =
  | { status: "idle" }
  | { status: "connecting" }
  | { status: "recording" }
  | { status: "error"; message: string }
  | { status: "unsupported" };

export default function AudioRecorder({
  isRecording,
  currentText = "",
  onTranscript,
  onRecordingChange,
  disabled,
  autoStart = false,
}: AudioRecorderProps) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<any>(null);
  const restartTimeoutRef = useRef<any>(null);

  const isRecordingRef = useRef<boolean>(false);
  const initialBaseTextRef = useRef<string>("");

  // Storage data structures for transcript accumulation
  const sessionFinalsRef = useRef<string[]>([]);
  const instanceInterimRef = useRef<string>("");

  const [micState, setMicState] = useState<MicState>({ status: "idle" });
  const [microphoneAvailable, setMicrophoneAvailable] = useState<boolean | null>(null);
  const [livePreviewText, setLivePreviewText] = useState<string>("");

  // Sync external text when NOT recording or when currentText is cleared (e.g. after submit)
  useEffect(() => {
    if (!isRecordingRef.current || !currentText) {
      initialBaseTextRef.current = (currentText || "").trim();
      sessionFinalsRef.current = [];
      instanceInterimRef.current = "";
      if (!currentText) {
        setLivePreviewText("");
      }
    }
  }, [currentText]);

  // Check mic availability on mount
  useEffect(() => {
    const hasWebSpeech = !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    if (!hasWebSpeech && !hasGetUserMedia) {
      setMicrophoneAvailable(false);
      return;
    }
    setMicrophoneAvailable(true);
  }, []);

  const cleanup = useCallback(() => {
    isRecordingRef.current = false;
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Flushes the active interim into sessionFinalsRef
  const flushInterim = useCallback(() => {
    const interim = instanceInterimRef.current.trim();
    if (interim) {
      sessionFinalsRef.current.push(interim);
      instanceInterimRef.current = "";
    }
  }, []);

  // Returns combined live preview text of base text + entire recording session so far
  const getFullSessionText = useCallback(() => {
    const baseText = initialBaseTextRef.current.trim();
    const activeInterim = instanceInterimRef.current.trim();

    const recordedParts = [
      ...sessionFinalsRef.current,
      activeInterim,
    ].filter(Boolean);

    const recordedText = recordedParts.join(" ").replace(/\s+/g, " ").trim();

    return [baseText, recordedText].filter(Boolean).join(" ");
  }, []);

  const startBrowserSpeechRecognition = useCallback((initialBase: string) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return false;

    try {
      initialBaseTextRef.current = initialBase.trim();
      sessionFinalsRef.current = [];
      instanceInterimRef.current = "";
      setLivePreviewText(initialBase.trim());

      const createAndStartInstance = () => {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = navigator.language || "en-US";

        recognition.onresult = (e: any) => {
          let latestInterim = "";
          const startIndex = typeof e.resultIndex === "number" ? e.resultIndex : 0;

          for (let i = startIndex; i < e.results.length; i++) {
            const res = e.results[i];
            const transcript = (res[0]?.transcript || "").trim();
            if (!transcript) continue;

            if (res.isFinal) {
              sessionFinalsRef.current.push(transcript);
            } else {
              latestInterim += (latestInterim ? " " : "") + transcript;
            }
          }

          instanceInterimRef.current = latestInterim;
          const fullText = getFullSessionText();
          setLivePreviewText(fullText);
          onTranscript(fullText);
        };

        recognition.onerror = (e: any) => {
          if (e.error !== "no-speech" && e.error !== "aborted") {
            console.warn("Speech recognition error:", e.error);
            if (e.error === "not-allowed" || e.error === "service-not-allowed") {
              isRecordingRef.current = false;
              setMicState({
                status: "error",
                message: "Microphone permission was denied. Please allow microphone access in your browser.",
              });
              onRecordingChange(false);
            }
          }
        };

        recognition.onend = () => {
          if (isRecordingRef.current) {
            flushInterim();
            setLivePreviewText(getFullSessionText());

            restartTimeoutRef.current = setTimeout(() => {
              if (!isRecordingRef.current) return;
              try {
                const nextInstance = createAndStartInstance();
                recognitionRef.current = nextInstance;
                nextInstance.start();
              } catch (err) {
                console.warn("Failed to restart speech recognition:", err);
              }
            }, 50);
            return;
          }

          setMicState({ status: "idle" });
          onRecordingChange(false);
        };

        return recognition;
      };

      const recognition = createAndStartInstance();
      recognitionRef.current = recognition;
      isRecordingRef.current = true;
      recognition.start();
      setMicState({ status: "recording" });
      onRecordingChange(true);
      return true;
    } catch (err) {
      console.warn("Failed to start browser speech recognition:", err);
      return false;
    }
  }, [flushInterim, getFullSessionText, onRecordingChange]);

  const startRecording = useCallback(async () => {
    setMicState({ status: "connecting" });

    const startingText = (currentText || "").trim();
    initialBaseTextRef.current = startingText;
    sessionFinalsRef.current = [];
    instanceInterimRef.current = "";

    // PRIMARY ENGINE: Speechmatics API Realtime WebSocket STT
    let token: string | null = null;
    try {
      const tokenRes = await getSpeechmaticsToken();
      token = tokenRes.token || null;
    } catch (err) {
      console.warn("Speechmatics token fetch failed, checking browser fallback:", err);
      token = null;
    }

    if (!token) {
      // Fallback to browser built-in Web Speech API if Speechmatics token unavailable
      console.log("Speechmatics API key not configured or token failed. Falling back to browser Speech Recognition...");
      if (startBrowserSpeechRecognition(startingText)) {
        return;
      }

      let msg = "Speech recognition is not supported in this browser. Please type your answer directly in the box above.";
      if (window.isSecureContext === false) {
        msg = "Microphone access is blocked because you are not on a secure context. Please access the site via http://localhost:3000 or HTTPS.";
      } else {
        msg = "SPEECHMATICS_API_KEY is not set in your .env file, and your browser does not support Web Speech API. Please add SPEECHMATICS_API_KEY or use Google Chrome.";
      }

      setMicState({
        status: "unsupported",
        message: msg,
      });
      onRecordingChange(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      setLivePreviewText(startingText);

      const ws = new WebSocket(`wss://eu.rt.speechmatics.com/v2?jwt=${token}`);
      wsRef.current = ws;
      let wsOpened = false;

      ws.onopen = () => {
        wsOpened = true;
        console.log("[Speechmatics Realtime STT] WebSocket connected. Sending StartRecognition config...");
        const startMsg = {
          message: "StartRecognition",
          transcription_config: { language: "en", enable_partials: true, max_delay: 1 },
          audio_format: { type: "raw", encoding: "pcm_f32le", sample_rate: 16000 },
        };
        ws.send(JSON.stringify(startMsg));

        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);

        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN) {
            const inputData = e.inputBuffer.getChannelData(0);
            ws.send(inputData.buffer);
          }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);

        isRecordingRef.current = true;
        setMicState({ status: "recording" });
        onRecordingChange(true);
      };

      const parseSpeechmaticsResults = (results: any[]): string => {
        if (!Array.isArray(results) || results.length === 0) return "";
        let text = "";
        for (const item of results) {
          const word = item.alternatives?.[0]?.content || "";
          if (!word) continue;
          if (item.type === "punctuation" || word === "." || word === "," || word === "?" || word === "!") {
            text += word;
          } else {
            text += (text ? " " : "") + word;
          }
        }
        return text.trim();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.message === "AddTranscript") {
            const finalText = parseSpeechmaticsResults(data.results);
            if (finalText) {
              sessionFinalsRef.current.push(finalText);
              instanceInterimRef.current = "";
            }
            const fullText = getFullSessionText();
            setLivePreviewText(fullText);
            onTranscript(fullText);
          } else if (data.message === "AddPartialTranscript") {
            const partialText = parseSpeechmaticsResults(data.results);
            instanceInterimRef.current = partialText;
            const fullText = getFullSessionText();
            setLivePreviewText(fullText);
            onTranscript(fullText);
          }
        } catch (e) {
          console.warn("Failed to parse Speechmatics WS message:", e);
        }
      };

      ws.onerror = (err) => {
        console.warn("Speechmatics WS error:", err);
        if (!wsOpened) {
          // If Speechmatics fails on open, try browser fallback as safety backup
          if (startBrowserSpeechRecognition(startingText)) {
            return;
          }
          setMicState({
            status: "error",
            message: "Unable to connect to Speechmatics speech recognition server. Please check SPEECHMATICS_API_KEY in .env.",
          });
          onRecordingChange(false);
          cleanup();
        }
      };

      ws.onclose = () => {
        setMicState({ status: "idle" });
      };
    } catch (err: any) {
      console.error("Failed to start recording:", err);
      let message = "Could not access microphone. Please ensure microphone permissions are granted.";
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        message = "Microphone access was denied. Please allow microphone permissions in your browser address bar settings.";
      }
      setMicState({
        status: "error",
        message,
      });
      onRecordingChange(false);
    }
  }, [cleanup, currentText, getFullSessionText, onRecordingChange, onTranscript, startBrowserSpeechRecognition]);

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;

    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    flushInterim();

    const recordedSessionText = sessionFinalsRef.current
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try { wsRef.current.send(JSON.stringify({ message: "EndOfStream" })); } catch {}
    }

    const baseText = initialBaseTextRef.current.trim();
    const finalFull = [baseText, recordedSessionText].filter(Boolean).join(" ");

    // Lock in full updated text immediately before emitting onTranscript
    initialBaseTextRef.current = finalFull;
    sessionFinalsRef.current = [];
    instanceInterimRef.current = "";
    setLivePreviewText("");

    onTranscript(finalFull);

    cleanup();
    setMicState({ status: "idle" });
    onRecordingChange(false);
  }, [cleanup, flushInterim, onRecordingChange, onTranscript]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // Handle autoStart prop
  useEffect(() => {
    if (autoStart && !disabled && !isRecordingRef.current && micState.status === "idle") {
      startRecording();
    }
  }, [autoStart, disabled, micState.status, startRecording]);

  const isMicUnsupported = microphoneAvailable === false;
  const hasError = micState.status === "error" || micState.status === "unsupported";

  return (
    <div className="flex flex-col items-center sm:items-start gap-2">
      {micState.status === "connecting" ? (
        <div className="flex items-center gap-2 text-foreground/80 bg-muted/50 px-3 py-1.5 rounded-lg border border-border">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-xs font-medium">Connecting mic...</span>
        </div>
      ) : micState.status === "recording" || isRecording ? (
        <div className="flex flex-col gap-2 w-full max-w-md">
          <div className="flex items-center gap-3">
            <button
              onClick={stopRecording}
              className="w-11 h-11 rounded-full bg-destructive text-white flex items-center justify-center animate-recording hover:bg-destructive/90 transition-all active:scale-95 cursor-pointer shadow-md shrink-0"
              aria-label="Stop recording"
              title="Click to stop recording"
            >
              <StopCircle className="w-5 h-5" />
            </button>

            <div className="flex flex-col text-left">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-destructive animate-ping" />
                <span className="text-xs text-rose-500 dark:text-rose-400 font-semibold whitespace-nowrap">Recording Active</span>
              </div>
              <p className="text-[11px] text-foreground/60 italic whitespace-nowrap">
                Listening... speak your response
              </p>
            </div>
          </div>

          {livePreviewText && (
            <div className="w-full bg-card border border-primary/30 rounded-lg p-2.5 text-left shadow-sm">
              <div className="flex items-center gap-1.5 text-[11px] text-primary font-semibold mb-0.5">
                <Volume2 className="w-3 h-3 animate-pulse text-primary" />
                Captured Speech:
              </div>
              <p className="text-xs text-foreground/90 italic leading-relaxed line-clamp-2">
                "{livePreviewText}"
              </p>
            </div>
          )}
        </div>
      ) : hasError ? (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-destructive/10 border border-destructive/20 text-xs text-rose-500">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="line-clamp-1 max-w-[200px] text-[11px]">{micState.message}</span>
          </div>
          <button
            onClick={() => setMicState({ status: "idle" })}
            className="p-1 text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2.5">
          <button
            onClick={startRecording}
            disabled={disabled || isMicUnsupported}
            className="w-11 h-11 rounded-full bg-primary text-on-primary flex items-center justify-center hover:opacity-90 transition-all disabled:opacity-50 active:scale-95 cursor-pointer shadow-md shrink-0"
            aria-label="Start recording"
            title={
              isMicUnsupported
                ? "Microphone not available in this browser"
                : "Start recording your answer"
            }
          >
            <Mic className="w-5 h-5" />
          </button>
          <div className="hidden md:flex flex-col text-left">
            <span className="text-xs font-semibold text-foreground/80 whitespace-nowrap">Voice Input</span>
            <span className="text-[11px] text-foreground/50 whitespace-nowrap">Click mic to record response</span>
          </div>
        </div>
      )}

      {isMicUnsupported && (
        <p className="text-[11px] text-foreground/50">
          Microphone unavailable. Type response in box.
        </p>
      )}
    </div>
  );
}