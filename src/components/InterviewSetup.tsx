import { useState, useEffect } from "react";
import {
  Building2,
  Briefcase,
  GraduationCap,
  PenTool,
  Layers,
  UserRound,
  Wrench,
  HeartHandshake,
  Cpu
} from "lucide-react";

export const EXPERIENCE_LEVELS = [
  "Apprenticeship / Trainee",
  "Internship",
  "Fresher / Entry Level (0 Years)",
  "Junior (0 - 2 Years)",
  "Mid-Level (2 - 5 Years)",
  "Senior / Lead (5+ Years)",
];

export const ROLES = [
  "Software Engineer",
  "Fullstack Developer",
  "Backend Engineer",
  "Frontend Developer",
  "Mobile Engineer (iOS/Android)",
  "Data Scientist / AI Engineer",
  "DevOps / Infrastructure Engineer",
  "Product Manager",
  "QA / Testing Engineer",
  "Other",
];

interface InterviewSetupProps {
  company: string;
  role: string;
  experienceLevel: string;
  interviewTrack: string;
  onChange: (company: string, role: string, experienceLevel: string, interviewTrack: string) => void;
}

export default function InterviewSetup({ company, role, experienceLevel, interviewTrack, onChange }: InterviewSetupProps) {
  const handleCompanyChange = (val: string) => onChange(val, role, experienceLevel, interviewTrack);
  const handleExperienceChange = (val: string) => onChange(company, role, val, interviewTrack);

  const isStandardRole = ROLES.includes(role) && role !== "Other";
  const [selectedRoleType, setSelectedRoleType] = useState<string>(() => {
    if (!role) return "";
    return isStandardRole ? role : "Other";
  });

  const [customRoleText, setCustomRoleText] = useState(() => {
    return isStandardRole ? "" : role;
  });

  useEffect(() => {
    const isStandard = ROLES.includes(role) && role !== "Other";
    if (role === "") {
      setSelectedRoleType("");
      setCustomRoleText("");
    } else if (isStandard) {
      setSelectedRoleType(role);
      setCustomRoleText("");
    } else {
      setSelectedRoleType("Other");
      setCustomRoleText(role);
    }
  }, [role]);

  const handleDropdownChange = (val: string) => {
    setSelectedRoleType(val);
    if (val === "Other") {
      onChange(company, customRoleText, experienceLevel, interviewTrack);
    } else {
      onChange(company, val, experienceLevel, interviewTrack);
    }
  };

  const handleCustomTextChange = (val: string) => {
    setCustomRoleText(val);
    onChange(company, val, experienceLevel, interviewTrack);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="label" htmlFor="company">
          <Building2 className="w-4 h-4 inline mr-1.5 text-primary" />
          Target Company
        </label>
        <input
          id="company"
          className="input"
          placeholder="e.g. Google, Stripe, Spotify, Amazon"
          value={company}
          onChange={(e) => handleCompanyChange(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="role-select">
            <Briefcase className="w-4 h-4 inline mr-1.5 text-primary" />
            Target Job Role
          </label>
          <select
            id="role-select"
            className="input bg-card text-foreground cursor-pointer font-medium"
            value={selectedRoleType}
            onChange={(e) => handleDropdownChange(e.target.value)}
          >
            <option value="" disabled>Select target role...</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="experienceLevel">
            <GraduationCap className="w-4 h-4 inline mr-1.5 text-primary" />
            Candidate Experience Level
          </label>
          <select
            id="experienceLevel"
            className="input bg-card text-foreground cursor-pointer font-medium"
            value={experienceLevel}
            onChange={(e) => handleExperienceChange(e.target.value)}
          >
            {EXPERIENCE_LEVELS.map((lvl) => (
              <option key={lvl} value={lvl}>
                {lvl}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedRoleType === "Other" && (
        <div className="animate-fade-in space-y-2">
          <label className="label" htmlFor="custom-role">
            <PenTool className="w-4 h-4 inline mr-1.5 text-primary animate-pulse" />
            Specify Custom Job Role
          </label>
          <input
            id="custom-role"
            className="input border-primary/40 focus:border-primary"
            placeholder="e.g. Solution Architect, Staff Developer, Security Engineer"
            value={customRoleText}
            onChange={(e) => handleCustomTextChange(e.target.value)}
          />
        </div>
      )}

      <div>
        <label className="label">
          <Layers className="w-4 h-4 inline mr-1.5 text-primary" />
          Choose Interview Track
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1.5">
          {[
            {
              id: "full",
              title: "Full-Fledged Interview",
              desc: "A comprehensive combination across all stages (technical, resume, and behavior).",
              icon: Layers,
              badge: "Recommended"
            },
            {
              id: "ai",
              title: "AI Role Interview",
              desc: "Trending AI topics (Agentic flows, LLM backend, RAG) paired with your resume projects.",
              icon: Cpu,
              badge: "Trending"
            },
            {
              id: "resume",
              title: "Resume Grind",
              desc: "Specific deep dive into your resume projects, metrics, tools, and execution.",
              icon: UserRound,
              badge: "Focused"
            },
            {
              id: "technical",
              title: "Core Job Questions",
              desc: "Assess core technical domains, system design, and algorithmic sandboxing.",
              icon: Wrench,
              badge: "Technical"
            },
            {
              id: "behavioral",
              title: "HR & Behavioral",
              desc: "Behavioral STAR scenarios, stakeholder teamwork, and culture fit.",
              icon: HeartHandshake,
              badge: "Culture"
            }
          ].map((track) => {
            const Icon = track.icon;
            const isSelected = interviewTrack === track.id;
            return (
              <button
                key={track.id}
                type="button"
                onClick={() => onChange(company, role, experienceLevel, track.id)}
                className={`text-left p-3.5 rounded-xl border transition-all relative flex flex-col justify-between h-full cursor-pointer hover:border-primary/50 ${
                  isSelected
                    ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/45"
                    : "border-border/80 bg-card hover:bg-muted/30"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-2 font-bold text-sm text-foreground">
                      <Icon className={`w-4 h-4 ${isSelected ? "text-primary" : "text-foreground/60"}`} />
                      {track.title}
                    </span>
                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
                      isSelected ? "bg-primary/20 text-primary" : "bg-muted text-foreground/45"
                    }`}>
                      {track.badge}
                    </span>
                  </div>
                  <p className="text-xs text-foreground/60 leading-relaxed">{track.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}