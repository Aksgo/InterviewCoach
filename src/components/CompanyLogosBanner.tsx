import React from "react";
import { CheckCircle2, ShieldCheck, Building2, Mic } from "lucide-react";

export const CompanyLogosBanner: React.FC = () => {
  const companies = [
    {
      name: "Amazon",
      logoUrl: "https://cdn.simpleicons.org/amazon/FF9900",
      fallbackLogoUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg",
      track: "Technical & Behavioral Loops",
    },
    {
      name: "Google",
      logoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg",
      fallbackLogoUrl: "https://cdn.simpleicons.org/google/4285F4",
      track: "System Design & Coding",
    },
    {
      name: "NVIDIA",
      logoUrl: "https://cdn.simpleicons.org/nvidia/76B900",
      fallbackLogoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/21/Nvidia_logo.svg",
      track: "AI & Systems Architecture",
    },
    {
      name: "Oracle",
      logoUrl: "https://cdn.simpleicons.org/oracle/F80000",
      fallbackLogoUrl: "https://upload.wikimedia.org/wikipedia/commons/5/50/Oracle_logo.svg",
      track: "Cloud & Infrastructure",
    },
  ];

  return (
    <section id="company-logos-banner" className="py-10 bg-gradient-to-b from-card via-background to-muted/30 border-y border-border/60 overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-6 text-center">
        
        {/* Header Tag */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-extrabold tracking-wide">
          <Building2 className="w-3.5 h-3.5" />
          <span>Targeted Company Loops</span>
        </div>

        {/* Main Section Heading */}
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
            Trusted by Candidates Interviewing at <span className="text-amber-500">Amazon</span>,{" "}
            <span className="text-teal-500">Google</span>, <span className="text-emerald-500">NVIDIA</span> &amp;{" "}
            <span className="text-rose-500">Oracle</span>
          </h2>
          <p className="text-xs sm:text-sm text-foreground/60 max-w-2xl mx-auto leading-relaxed">
            Practice technical and behavioral interview loops tailored to company-specific rubrics using our grounded AI voice interviewer.
          </p>
        </div>

        {/* Logo Tiles Grid (4 Companies) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
          {companies.map((comp) => (
            <div
              key={comp.name}
              id={`company-tile-${comp.name.toLowerCase()}`}
              className="group p-4 rounded-2xl bg-card border border-border/80 hover:border-primary/40 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col items-center justify-center space-y-3 hover:-translate-y-0.5 cursor-default"
            >
              <div className="p-2.5 rounded-xl bg-muted/60 group-hover:bg-primary/10 transition-colors flex items-center justify-center w-12 h-12">
                <img
                  src={comp.logoUrl}
                  alt={`${comp.name} logo`}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 object-contain group-hover:scale-110 transition-transform duration-300"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (target.src !== comp.fallbackLogoUrl) {
                      target.src = comp.fallbackLogoUrl;
                    }
                  }}
                />
              </div>
              <div className="text-center space-y-0.5">
                <p className="text-sm font-extrabold text-foreground tracking-tight">{comp.name}</p>
                <p className="text-[10px] text-foreground/50 font-medium">{comp.track}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Verification Banner - Cleaned of false statistics & claims */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-6 text-xs text-foreground/60">
          <div className="flex items-center gap-1.5 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Grounded Question Sets</span>
          </div>
          <div className="flex items-center gap-1.5 font-semibold">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>Company-Specific STAR Rubrics</span>
          </div>
          <div className="flex items-center gap-1.5 font-semibold">
            <Mic className="w-4 h-4 text-teal-500" />
            <span>Real-Time AI Voice Feedback</span>
          </div>
        </div>

      </div>
    </section>
  );
};

export default CompanyLogosBanner;
