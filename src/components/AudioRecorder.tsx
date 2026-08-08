import { Mic, StopCircle, Loader2, AlertCircle, RefreshCw, Volume2 } from "lucide-react";
import { useRef, useState, useCallback, useEffect } from "react";
import { getSpeechmaticsToken } from "../utils/api";

interface AudioRecorderProps {
  isRecording: boolean;
  currentText?: string;
  onTranscript: (text: string) => void;
  onRecordingChange: (recording: boolean) => void;
  disabled?: boolean;
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
  const instanceFinalsRef = useRef<Map<number, string>>(new Map());
  const instanceInterimRef = useRef<string>("");

  const [micState, setMicState] = useState<MicState>({ status: "idle" });
  const [microphoneAvailable, setMicrophoneAvailable] = useState<boolean | null>(null);
  const [livePreviewText, setLivePreviewText] = useState<string>("");

  // Sync external text when NOT recording (e.g. when user edits text box manually)
  useEffect(() => {
    if (!isRecordingRef.current) {
      initialBaseTextRef.current = (currentText || "").trim();
      sessionFinalsRef.current = [];
      instanceFinalsRef.current.clear();
      instanceInterimRef.current = "";
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

  // Flushes the active instance results into sessionFinalsRef
  const flushInstance = useCallback(() => {
    const finals = Array.from(instanceFinalsRef.current.values()).filter(Boolean);
    if (finals.length > 0) {
      sessionFinalsRef.current.push(...finals);
    }
    instanceFinalsRef.current.clear();

    const interim = instanceInterimRef.current.trim();
    if (interim) {
      sessionFinalsRef.current.push(interim);
      instanceInterimRef.current = "";
    }
  }, []);

  // Returns combined live preview text of entire recording session so far
  const getFullSessionText = useCallback(() => {
    const activeFinals = Array.from(instanceFinalsRef.current.values()).filter(Boolean);
    const activeInterim = instanceInterimRef.current.trim();

    const allParts = [
      ...sessionFinalsRef.current,
      ...activeFinals,
      activeInterim,
    ].filter(Boolean);

    return allParts.join(" ").replace(/\s+/g, " ").trim();
  }, []);

  const startBrowserSpeechRecognition = useCallback((initialBase: string) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return false;

    try {
      initialBaseTextRef.current = initialBase.trim();
      sessionFinalsRef.current = [];
      instanceFinalsRef.current.clear();
      instanceInterimRef.current = "";
      setLivePreviewText("");

      const createAndStartInstance = () => {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = navigator.language || "en-US";

        recognition.onresult = (e: any) => {
          let latestInterim = "";

          for (let i = 0; i < e.results.length; i++) {
            const res = e.results[i];
            const transcript = (res[0]?.transcript || "").trim();
            if (!transcript) continue;

            if (res.isFinal) {
              instanceFinalsRef.current.set(i, transcript);
            } else {
              latestInterim = transcript;
            }
          }

          instanceInterimRef.current = latestInterim;
          setLivePreviewText(getFullSessionText());
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
            flushInstance();
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
  }, [flushInstance, getFullSessionText, onRecordingChange]);

  const startRecording = useCallback(async () => {
    setMicState({ status: "connecting" });

    const startingText = currentText || "";

    if (startBrowserSpeechRecognition(startingText)) {
      return;
    }

    // Fallback to Speechmatics WebSocket if Web Speech API is not available
    try {
      let token: string | null = null;
      try {
        const tokenRes = await getSpeechmaticsToken();
        token = tokenRes.token;
      } catch {
        token = null;
      }

      if (!token || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setMicState({
          status: "unsupported",
          message: "Speech recognition is not supported in this browser. Please type your answer directly in the box above.",
        });
        onRecordingChange(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      initialBaseTextRef.current = startingText.trim();
      sessionFinalsRef.current = [];
      instanceFinalsRef.current.clear();
      instanceInterimRef.current = "";
      setLivePreviewText("");

      const ws = new WebSocket(`wss://eu.rt.speechmatics.com/v2?jwt=${token}`);
      wsRef.current = ws;
      let wsOpened = false;

      ws.onopen = () => {
        wsOpened = true;
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

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.message === "AddTranscript") {
            const text = data.results?.map((r: any) => r.alternatives?.[0]?.content || "").join(" ").trim();
            if (text) {
              if (data.is_final) {
                sessionFinalsRef.current.push(text);
                instanceInterimRef.current = "";
              } else {
                instanceInterimRef.current = text;
              }
              setLivePreviewText(getFullSessionText());
            }
          }
        } catch {}
      };

      ws.onerror = (err) => {
        console.warn("Speechmatics WS error:", err);
        if (!wsOpened) {
          setMicState({
            status: "error",
            message: "Unable to connect to live speech recognition server. Please try again or type directly.",
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
      let message = "Could not access microphone. Please ensure microphone permissions are granted or type your answer below.";
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        message = "Microphone access was denied. Please allow microphone permissions in your browser address bar settings, or type your answer directly.";
      } else if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
        message = "No microphone hardware found on your device. You can type your answer in the text box below.";
      } else if (err?.name === "NotReadableError" || err?.name === "TrackStartError") {
        message = "Microphone is currently in use by another application or blocked. Please check your system settings or type your answer.";
      }
      setMicState({
        status: "error",
        message,
      });
      onRecordingChange(false);
    }
  }, [cleanup, currentText, getFullSessionText, onRecordingChange, startBrowserSpeechRecognition]);

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;

    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    // Flush any pending interim / instance results into sessionFinalsRef
    flushInstance();

    // Get complete accumulated session transcript
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

    // Combine base text + full recorded transcript
    const finalFull = [baseText, recordedSessionText].filter(Boolean).join(" ");

    // Place complete transcript into answer box
    onTranscript(finalFull);

    // Reset session refs
    initialBaseTextRef.current = finalFull;
    sessionFinalsRef.current = [];
    instanceFinalsRef.current.clear();
    instanceInterimRef.current = "";
    setLivePreviewText("");

    cleanup();
    setMicState({ status: "idle" });
    onRecordingChange(false);
  }, [cleanup, flushInstance, onRecordingChange, onTranscript]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const isMicUnsupported = microphoneAvailable === false;
  const hasError = micState.status === "error" || micState.status === "unsupported";

  return (
    <div className="flex flex-col items-center gap-3">
      {micState.status === "connecting" ? (
        <div className="flex items-center gap-2 text-foreground/60">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Connecting to speech recognition...</span>
        </div>
      ) : micState.status === "recording" || isRecording ? (
        <div className="flex flex-col items-center gap-3 w-full max-w-lg">
          <button
            onClick={stopRecording}
            className="w-16 h-16 rounded-full bg-destructive text-white flex items-center justify-center animate-recording hover:bg-destructive/90 transition-all active:scale-95 cursor-pointer shadow-lg"
            aria-label="Stop recording"
            title="Click to stop recording and place transcript in your answer"
          >
            <StopCircle className="w-8 h-8" />
          </button>

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-ping" />
            <span className="text-sm text-destructive font-semibold">Recording Active... Click Red Button to Finish</span>
          </div>

          {livePreviewText ? (
            <div className="w-full bg-accent/10 border border-accent/20 rounded-lg p-3 text-left">
              <div className="flex items-center gap-1.5 text-xs text-accent font-medium mb-1">
                <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                Live Audio Captured So Far:
              </div>
              <p className="text-sm text-foreground/80 italic leading-relaxed">
                "{livePreviewText}"
              </p>
            </div>
          ) : (
            <p className="text-xs text-foreground/50 italic text-center">
              Listening... Speak your answer now. Press Stop when finished to insert into your answer box.
            </p>
          )}
        </div>
      ) : hasError ? (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 max-w-sm">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive/80 leading-relaxed">{micState.message}</p>
          </div>
          <button
            onClick={() => setMicState({ status: "idle" })}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Try Again
          </button>
        </div>
      ) : (
        <button
          onClick={startRecording}
          disabled={disabled || isMicUnsupported}
          className="relative w-16 h-16 rounded-full bg-accent text-white flex items-center justify-center hover:opacity-90 transition-all disabled:opacity-50 active:scale-95 cursor-pointer shadow-md"
          aria-label="Start recording"
          title={
            isMicUnsupported
              ? "Microphone not available in this browser"
              : "Start recording your answer"
          }
        >
          <Mic className="w-8 h-8" />
        </button>
      )}

      {isMicUnsupported && (
        <p className="text-xs text-foreground/40 text-center max-w-xs">
          Microphone access isn't available in this browser. Type your answer below instead.
        </p>
      )}
    </div>
  );
}
