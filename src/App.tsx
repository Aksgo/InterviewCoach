import { BrowserRouter, Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import HomePage from "./pages/HomePage";
import InterviewPage from "./pages/InterviewPage";
import ResultsPage from "./pages/ResultsPage";
import { AIStatusProvider } from "./context/AIStatusContext";
import { ThemeProvider } from "./context/ThemeContext";
import AIStatusModal from "./components/AIStatusModal";

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
            </Routes>
            <AIStatusModal />
          </div>
        </BrowserRouter>
      </AIStatusProvider>
    </ThemeProvider>
  );
}