import React, { useState, useEffect } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Maximize2,
  Sparkles,
  Mic,
  Code2,
  Briefcase,
  FileText,
  ArrowRight,
  Radio,
  UserCheck,
  MousePointer2,
  CheckCircle2,
  Layers,
  Send,
  Terminal,
  MessageSquare
} from "lucide-react";

interface DemoVideoPlayerProps {
  onStartPractice?: () => void;
}

export const DemoVideoPlayer: React.FC<DemoVideoPlayerProps> = ({ onStartPractice }) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [progress, setProgress] = useState<number>(0);
  const [activeScene, setActiveScene] = useState<number>(0); // 0, 1, 2, 3, 4
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);

  // Exact captions from the provided product demonstration video
  const sceneCaptions = [
    { id: 0, text: "Welcome to your new AI coach", time: "00:00" },
    { id: 1, text: "Setup your target role", time: "00:02" },
    { id: 2, text: "Choose your perfect practice track", time: "00:04" },
    { id: 3, text: "Interact with our live AI", time: "00:06" },
    { id: 4, text: "Get real-time feedback", time: "00:08" },
  ];

  // Auto playback timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) return 0;
          return prev + 1;
        });
      }, 100); // 100ms * 100 = 10s total video loop
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying]);

  // Sync active scene according to progress
  useEffect(() => {
    if (progress < 20) {
      setActiveScene(0);
    } else if (progress < 40) {
      setActiveScene(1);
    } else if (progress < 60) {
      setActiveScene(2);
    } else if (progress < 80) {
      setActiveScene(3);
    } else {
      setActiveScene(4);
    }
  }, [progress]);

  const handleSeek = (sceneIdx: number) => {
    setActiveScene(sceneIdx);
    setProgress(sceneIdx * 20 + 2);
  };

  const formatTime = (p: number) => {
    const totalSeconds = Math.floor((p / 100) * 10);
    const secs = totalSeconds < 10 ? `0${totalSeconds}` : `${totalSeconds}`;
    return `00:${secs}`;
  };

  // Modern camera zoom per frame
  const getCameraZoom = (idx: number) => {
    switch (idx) {
      case 0:
        return "scale-100 translate-x-0 translate-y-0";
      case 1:
        return "scale-105 origin-top-left translate-x-1 translate-y-1";
      case 2:
        return "scale-105 origin-center";
      case 3:
        return "scale-105 origin-center";
      case 4:
        return "scale-105 origin-bottom-right -translate-x-1 -translate-y-1";
      default:
        return "scale-100";
    }
  };

  return (
    <div
      className={`w-full rounded-2xl border border-border bg-zinc-950 text-white shadow-2xl overflow-hidden flex flex-col transition-all ${
        isFullScreen ? "fixed inset-4 z-50 max-w-none h-[calc(100vh-2rem)]" : "relative"
      }`}
    >
      {/* Top Browser Window Header */}
      <div className="px-4 py-3 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500/90 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500/90 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/90 inline-block" />
          </div>
          <span className="font-mono text-[11px] text-zinc-400 hidden sm:inline border-l border-zinc-700 pl-3">
            AI Interview Coach — Product Video Walkthrough
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            {sceneCaptions[activeScene].time} / 00:10
          </span>
          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Video Screen Container */}
      <div className="relative flex-1 min-h-[420px] sm:min-h-[500px] bg-gradient-to-b from-zinc-900 via-zinc-950 to-black overflow-hidden flex flex-col justify-between select-none">
        
        {/* Prominent Video Text Caption Overlay (Matching Provided Video) */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none transition-all duration-500">
          <div className="bg-zinc-900/90 border border-zinc-700/80 backdrop-blur-md px-5 py-2 rounded-xl shadow-2xl flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
            <span className="text-xs sm:text-sm font-extrabold text-white tracking-wide">
              {sceneCaptions[activeScene].text}
            </span>
          </div>
        </div>

        {/* Floating Mouse Pointer Simulation */}
        <div
          className={`absolute pointer-events-none z-40 transition-all duration-700 ease-in-out flex items-center gap-1.5 ${
            activeScene === 0
              ? "top-36 left-1/3 opacity-90 scale-100"
              : activeScene === 1
              ? "top-48 left-1/2 opacity-90 scale-95"
              : activeScene === 2
              ? "top-32 left-1/4 opacity-90 scale-95"
              : activeScene === 3
              ? "bottom-16 left-1/4 opacity-90 scale-100"
              : "bottom-12 right-12 opacity-90 scale-100"
          }`}
        >
          <MousePointer2 className="w-5 h-5 text-primary fill-primary stroke-white drop-shadow-md animate-pulse" />
        </div>

        {/* Dynamic Zoom & Pan Video Stage */}
        <div
          className={`w-full h-full p-4 sm:p-6 transition-all duration-1000 ease-in-out transform ${getCameraZoom(
            activeScene
          )}`}
        >
          {/* SCENE 0: Welcome to your new AI coach */}
          {activeScene === 0 && (
            <div className="w-full h-full flex flex-col justify-between space-y-6 transition-all duration-500 pt-8">
              {/* Top Bar Simulation */}
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3 text-xs text-zinc-300">
                <div className="flex items-center gap-2 font-bold text-white">
                  <img src="/nativelyai.svg" alt="Interview Coach Logo" className="w-6 h-6 object-contain shrink-0" />
                  <span>Interview Coach</span>
                </div>
                <div className="hidden sm:flex items-center gap-4 text-[11px] text-zinc-400">
                  <span className="text-emerald-400 font-semibold border-b-2 border-emerald-400 pb-0.5">Practices</span>
                  <span>About</span>
                  <span>Series</span>
                  <span>Contact</span>
                </div>
                <button className="px-3 py-1 bg-primary text-white text-[10px] font-bold rounded-lg shadow-sm">Sign Up</button>
              </div>

              {/* Hero Main Content */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center my-auto">
                <div className="md:col-span-7 space-y-3 text-left">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-bold border border-amber-500/30">
                    <Sparkles className="w-3 h-3" />
                    <span>Train with AI Agents</span>
                  </div>
                  <h2 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight">
                    Train for <span className="text-teal-400">Real Interviews</span> <br />
                    with <span className="text-primary">AI Agents</span>
                  </h2>
                  <p className="text-xs text-zinc-300 leading-relaxed max-w-md">
                    Get a simulated voice interview to test your skills with AI. Upload your resume, select target companies, and get instant Speechmatics audio feedback.
                  </p>
                  <div className="flex items-center gap-3 pt-1">
                    <span className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-md">
                      <span>Get Features</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                    <span className="px-4 py-2 bg-zinc-800 text-zinc-300 text-xs font-semibold rounded-lg border border-zinc-700">
                      Learn More
                    </span>
                  </div>
                </div>

                {/* Persona Avatar Cards */}
                <div className="md:col-span-5 relative">
                  <div className="relative rounded-xl border border-zinc-700 bg-zinc-900 p-3 shadow-2xl">
                    <img
                      src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400"
                      alt="AI Lead"
                      referrerPolicy="no-referrer"
                      className="w-full h-36 sm:h-44 object-cover rounded-lg"
                    />
                    <div className="absolute top-5 left-5 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] text-emerald-400 font-bold border border-emerald-500/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      <span>Nanya Govil (AI Lead)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feature Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-zinc-800">
                <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-left">
                  <p className="text-[11px] font-bold text-white">Adia AI Interview</p>
                  <p className="text-[9px] text-zinc-400">Speechmatics STT</p>
                </div>
                <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-left">
                  <p className="text-[11px] font-bold text-white">Cac Maz Interview</p>
                  <p className="text-[9px] text-zinc-400">Grounded Questions</p>
                </div>
                <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-left">
                  <p className="text-[11px] font-bold text-white">AI Role Interview</p>
                  <p className="text-[9px] text-zinc-400">System Design &amp; Code</p>
                </div>
                <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-left">
                  <p className="text-[11px] font-bold text-white">Care Job Interview</p>
                  <p className="text-[9px] text-zinc-400">Detailed Feedback</p>
                </div>
              </div>
            </div>
          )}

          {/* SCENE 1: Setup your target role */}
          {activeScene === 1 && (
            <div className="w-full h-full flex flex-col justify-between space-y-4 transition-all duration-500 pt-8">
              <div className="text-left space-y-1 border-b border-zinc-800 pb-2">
                <h3 className="text-xl sm:text-2xl font-extrabold text-white">Practice Setup &amp; Registration</h3>
                <p className="text-xs text-zinc-400">Screen setup, select AI Target Company, target role, and upload resume.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-auto">
                <div className="space-y-3 bg-zinc-900/90 border border-primary/50 rounded-xl p-4 text-left shadow-2xl ring-1 ring-primary/20">
                  <div>
                    <label className="text-[11px] font-bold text-zinc-300">Target Company *</label>
                    <div className="mt-1 p-2 rounded-lg bg-zinc-950 border border-zinc-700 text-xs text-zinc-200 flex items-center justify-between">
                      <span className="font-semibold text-white">Target Company</span>
                      <Briefcase className="w-3.5 h-3.5 text-primary" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-zinc-300">Target Job Role *</label>
                    <div className="mt-1 p-2 rounded-lg bg-zinc-950 border border-zinc-700 text-xs text-zinc-200 flex items-center justify-between">
                      <span className="font-semibold text-teal-400">Target Job Role</span>
                      <UserCheck className="w-3.5 h-3.5 text-teal-400" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-zinc-300">Resume &amp; User Details</label>
                    <div className="mt-1 p-2.5 rounded-lg bg-zinc-950/80 border border-dashed border-primary text-xs text-zinc-200 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary animate-bounce" />
                      <span className="font-bold">User Name / Resume Uploaded</span>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 text-left flex flex-col justify-between">
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-white">Police Type / Mode</h4>
                    <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-400 flex items-center gap-2">
                      <Radio className="w-4 h-4 animate-pulse" />
                      <span>Online Voice Mode (Speechmatics)</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Converts spoken audio into live transcriptions automatically.
                    </p>
                  </div>

                  <button className="w-full mt-4 py-2.5 bg-primary text-white font-bold text-xs rounded-lg shadow-lg flex items-center justify-center gap-2">
                    <span>Submit</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SCENE 2: Choose your perfect practice track */}
          {activeScene === 2 && (
            <div className="w-full h-full flex flex-col justify-between space-y-4 transition-all duration-500 pt-8">
              <div className="text-left space-y-1 border-b border-zinc-800 pb-2">
                <h3 className="text-lg sm:text-2xl font-extrabold text-white">Available Practice Tracks to Choose From:</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-auto">
                <div className="bg-gradient-to-b from-primary/30 via-zinc-900 to-zinc-900 border-2 border-primary rounded-xl p-4 text-left relative shadow-2xl ring-2 ring-primary/40">
                  <span className="absolute -top-3 right-3 bg-primary text-white text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-md">
                    Recommended
                  </span>
                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                    <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                    <span>Full-Fledged Interview</span>
                  </div>
                  <p className="text-[11px] text-zinc-200 mt-2 leading-relaxed">
                    A comprehensive interview covering all stages (technical, resume, and behavior).
                  </p>
                  <div className="mt-3 pt-2 border-t border-zinc-800 flex items-center justify-between text-[10px] text-emerald-400 font-bold">
                    <span>Launch Live Practicing Call</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3.5 text-left">
                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                    <Code2 className="w-4 h-4 text-teal-400" />
                    <span>AI Role Interview</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1.5 leading-relaxed">
                    Training AI targeted (gigantic flows, LLM backend, RAG) passed with your resume projects.
                  </p>
                </div>

                <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3.5 text-left">
                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span>Resume Grind</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1.5 leading-relaxed">
                    Specific deep dive into your resume projects, metrics, stack, and execution.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SCENE 3: Interact with our live AI */}
          {activeScene === 3 && (
            <div className="w-full h-full flex flex-col justify-between space-y-3 transition-all duration-500 pt-8">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <span className="font-bold text-white">Senior AI Technical Interviewer</span>
                </div>
                <span className="text-[10px] bg-primary/20 text-primary font-bold px-2 py-0.5 rounded border border-primary/30">
                  Live Call Active
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 my-auto">
                <div className="md:col-span-5 bg-zinc-900 border border-primary/40 rounded-xl p-4 flex flex-col items-center justify-center text-center space-y-3 shadow-2xl">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-primary via-accent to-teal-400 p-1 animate-pulse">
                      <img
                        src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=300"
                        alt="Male AI Technical Interviewer"
                        referrerPolicy="no-referrer"
                        className="w-full h-full rounded-full object-cover"
                      />
                    </div>
                    <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-zinc-900 flex items-center justify-center">
                      <Mic className="w-3 h-3 text-white" />
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-white">Senior AI Technical Interviewer</h4>
                    <p className="text-[10px] text-teal-400 font-semibold mt-0.5">Interviewer is synthesizing verbal response...</p>
                  </div>

                  <div className="flex items-center justify-center gap-1.5 h-6 w-full max-w-[160px]">
                    <span className="w-1.5 bg-primary h-5 rounded-full animate-bounce" />
                    <span className="w-1.5 bg-accent h-6 rounded-full animate-bounce [animation-delay:0.1s]" />
                    <span className="w-1.5 bg-teal-400 h-3 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1.5 bg-emerald-400 h-5 rounded-full animate-bounce [animation-delay:0.15s]" />
                  </div>
                </div>

                <div className="md:col-span-7 space-y-2 text-left">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-1">
                    <p className="text-[10px] font-bold text-primary flex items-center gap-1">
                      <Volume2 className="w-3 h-3 animate-pulse" /> Live Transcript:
                    </p>
                    <p className="text-xs text-zinc-100 italic leading-snug">
                      "You recall AI translating..."
                    </p>
                  </div>

                  <div className="bg-zinc-900 border border-emerald-500/40 rounded-xl p-3 space-y-1">
                    <p className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" /> Listening...
                    </p>
                    <p className="text-xs text-zinc-200 font-mono">
                      Speak your response...
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SCENE 4: Get real-time feedback */}
          {activeScene === 4 && (
            <div className="w-full h-full flex flex-col justify-between space-y-3 transition-all duration-500 pt-8">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2 text-xs">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-primary" />
                  Code Sandbox &amp; Real-Time Feedback
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-500/30">
                  Feedback Synced
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 my-auto">
                <div className="md:col-span-6 bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-left space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 border-b border-zinc-800 pb-1">
                    <span className="font-mono text-white">Live Transcript &amp; Feedback</span>
                    <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded">AI Grounded</span>
                  </div>
                  <p className="text-xs text-zinc-200 leading-relaxed font-sans">
                    "You are well versed with system design trade-offs. Your answer demonstrates good clarity on memory management and async loop optimization."
                  </p>
                </div>

                <div className="md:col-span-6 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-left font-mono space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 border-b border-zinc-800 pb-1">
                    <span>Code Sandbox</span>
                    <span className="text-teal-400">TypeScript</span>
                  </div>
                  <pre className="text-[11px] text-emerald-400 leading-snug overflow-x-auto p-1">
{`1  const cache = new Map();
2  async function getHotData(id) {
3    if (cache.has(id)) return cache.get(id);
4    const res = await db.query(id);
5    cache.set(id, res);
6    return res;
7  }`}
                  </pre>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-zinc-800 pt-2">
                <span className="text-xs text-zinc-400 font-mono">Review &amp; Submit Real-time Scorecard</span>
                {onStartPractice && (
                  <button
                    onClick={onStartPractice}
                    className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-lg shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Try It Now Yourself</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Bottom Video Control Bar & Scene Timeline */}
      <div className="px-4 py-3 bg-zinc-900 border-t border-zinc-800 flex flex-col gap-2 shrink-0">
        
        {/* Timeline Progress Bar */}
        <div className="relative w-full bg-zinc-800 h-2 rounded-full overflow-hidden cursor-pointer group">
          <div
            className="h-full bg-gradient-to-r from-primary via-accent to-emerald-400 transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Playback Controls and Jump Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-300">
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center transition-colors cursor-pointer"
              title={isPlaying ? "Pause Video" : "Play Video"}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 translate-x-0.5" />}
            </button>

            <button
              onClick={() => {
                setProgress(0);
                setActiveScene(0);
                setIsPlaying(true);
              }}
              className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Replay Video"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <span className="font-mono text-xs text-zinc-400">
              {formatTime(progress)} / 00:10
            </span>
          </div>

          {/* Scene Jump Pills */}
          <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1 sm:pb-0">
            {sceneCaptions.map((scene) => (
              <button
                key={scene.id}
                onClick={() => handleSeek(scene.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeScene === scene.id
                    ? "bg-primary text-white shadow-sm"
                    : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {scene.text}
              </button>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
};

export default DemoVideoPlayer;
