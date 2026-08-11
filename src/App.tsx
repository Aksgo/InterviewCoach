import { BrowserRouter, Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import HomePage from "./pages/HomePage";
import InterviewPage from "./pages/InterviewPage";
import ResultsPage from "./pages/ResultsPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import { AIStatusProvider } from "./context/AIStatusContext";
import { ThemeProvider } from "./context/ThemeContext";
import AIStatusModal from "./components/AIStatusModal";
import { Analytics } from "@vercel/analytics/next"

export default function App() {
  return (
    <ThemeProvider>
      <AIStatusProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
            <Header />
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/interview" element={<InterviewPage />} />
              <Route path="/results" element={<ResultsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
            </Routes>
            <AIStatusModal />
          </div>
        </BrowserRouter>
      </AIStatusProvider>
    </ThemeProvider>
  );
}