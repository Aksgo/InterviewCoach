import { useState, useEffect } from "react";

interface StreamingTextProps {
  text: string;
  isSpeaking: boolean;
  isRevealed: boolean;
  audioElement: HTMLAudioElement | null;
}

export default function StreamingText({
  text,
  isSpeaking,
  isRevealed,
  audioElement
}: StreamingTextProps) {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    if (!isRevealed) {
      setDisplayedText("");
      return;
    }

    if (!isSpeaking) {
      setDisplayedText(text);
      return;
    }

    const words = text.split(" ");
    if (words.length === 0) {
      setDisplayedText("");
      return;
    }

    setDisplayedText(words[0]);
    let wordIndex = 0;

    // Estimate word delay
    let wordDelay = 300; // default 300ms per word
    
    if (audioElement && audioElement.duration && isFinite(audioElement.duration)) {
      const durationMs = audioElement.duration * 1000;
      // Buffer of 300ms so text completes slightly before audio ends
      wordDelay = Math.max(120, (durationMs - 300) / words.length);
    } else {
      // Typical conversational speaking rate: ~140 WPM
      wordDelay = 350;
    }

    const interval = setInterval(() => {
      wordIndex++;
      if (wordIndex >= words.length) {
        clearInterval(interval);
        setDisplayedText(text);
      } else {
        setDisplayedText(words.slice(0, wordIndex + 1).join(" "));
      }
    }, wordDelay);

    return () => {
      clearInterval(interval);
    };
  }, [text, isSpeaking, isRevealed, audioElement]);

  return (
    <p className="text-sm font-medium text-white leading-relaxed animate-fade-in transition-all">
      "{displayedText}"
    </p>
  );
}
