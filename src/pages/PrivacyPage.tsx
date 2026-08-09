import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
        <h1 className="text-4xl font-extrabold mb-6">Privacy Policy</h1>
        <div className="prose prose-sm sm:prose-base prose-invert text-foreground/80">
          <p className="mb-4">Last updated: August 2026</p>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-foreground">1. No Data Collection</h2>
          <p className="mb-4">
            Welcome to Interview Coach. This application is designed as a secure, sandboxed tool. 
            We do not require you to create an account, and we do not collect, store, or sell any personal data (such as your name, email, or contact information).
          </p>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-foreground">2. Resume and Interview Data</h2>
          <p className="mb-4">
            Any resume text you upload or paste is processed locally and temporarily sent to our AI providers (like Google Gemini) solely for the purpose of generating your mock interview questions and providing feedback. 
            We do not save your resume text, voice recordings, or interview performance data to any permanent database. All session data is stored locally on your device in your browser's storage and is cleared when you clear your browser data.
          </p>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-foreground">3. Third-Party Services</h2>
          <p className="mb-4">
            To provide speech-to-text and text-to-speech capabilities, we may temporarily stream audio to third-party services (such as Speechmatics). These audio streams are ephemeral and are not retained by us.
          </p>
          <h2 className="text-2xl font-bold mt-8 mb-4 text-foreground">4. Changes to This Policy</h2>
          <p className="mb-4">
            We may update our Privacy Policy from time to time. We will notify you of any changes by updating the "Last updated" date of this Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
