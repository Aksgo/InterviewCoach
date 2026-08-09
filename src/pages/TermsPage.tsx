import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
        <h1 className="text-4xl font-extrabold mb-6">Terms of Service</h1>
        <div className="prose prose-sm sm:prose-base prose-invert text-foreground/80">
          <p className="mb-4">Last updated: August 2026</p>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-foreground">1. Educational Purpose</h2>
          <p className="mb-4">
            Interview Coach is an experimental, educational sandbox tool designed to help you practice interviewing skills. It relies on AI models to generate questions and feedback, which may not always be accurate, perfect, or reflect real-world interview scenarios exactly.
          </p>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-foreground">2. Disclaimer of Warranties</h2>
          <p className="mb-4">
            The service is provided "as is" and "as available". We make no warranties, expressed or implied, regarding the accuracy, reliability, or availability of the service. We do not guarantee that the mock interviews will lead to real-world employment or accurately assess your technical skills.
          </p>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-foreground">3. User Responsibility</h2>
          <p className="mb-4">
            You are solely responsible for the information you provide (such as your resume text) and your interactions with the AI. Do not share highly sensitive, classified, or confidential information during the mock interviews.
          </p>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-foreground">4. Changes to Terms</h2>
          <p className="mb-4">
            We may revise these Terms of Service at any time without prior notice. By continuing to use the service, you agree to be bound by the current version of these Terms.
          </p>
        </div>
      </div>
    </div>
  );
}
