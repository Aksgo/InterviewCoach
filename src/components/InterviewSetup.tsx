import { Building2, Briefcase } from "lucide-react";

interface InterviewSetupProps {
  company: string;
  role: string;
  onChange: (company: string, role: string) => void;
}

export default function InterviewSetup({ company, role, onChange }: InterviewSetupProps) {
  const handleCompanyChange = (val: string) => onChange(val, role);
  const handleRoleChange = (val: string) => onChange(company, val);

  return (
    <div className="space-y-4">
      <div>
        <label className="label" htmlFor="company">
          <Building2 className="w-4 h-4 inline mr-1.5" />
          Target Company
        </label>
        <input
          id="company"
          className="input"
          placeholder="e.g. Google, Stripe, Spotify"
          value={company}
          onChange={(e) => handleCompanyChange(e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="role">
          <Briefcase className="w-4 h-4 inline mr-1.5" />
          Job Role
        </label>
        <input
          id="role"
          className="input"
          placeholder="e.g. Senior Frontend Engineer, Product Manager"
          value={role}
          onChange={(e) => handleRoleChange(e.target.value)}
        />
      </div>
    </div>
  );
}