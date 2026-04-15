import { useState, useEffect, useRef, useCallback } from 'react';
import { HapticManager } from '../services/hapticManager';

interface UseTypewriterOptions {
  text: string;
  speed?: number;
  startDelay?: number;
  haptic?: boolean;
  hapticInterval?: number;
  onComplete?: () => void;
}

interface UseTypewriterReturn {
  displayedText: string;
  isTyping: boolean;
  isComplete: boolean;
  reset: () => void;
}

export function useTypewriter({
  text,
  speed = 30,
  startDelay = 400,
  haptic = true,
  hapticInterval = 3,
  onComplete,
}: UseTypewriterOptions): UseTypewriterReturn {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const indexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    indexRef.current = 0;
    setDisplayedText('');
    setIsTyping(false);
    setIsComplete(false);
  }, []);

  useEffect(() => {
    if (!text) return;
    reset();

    const startTimeout = setTimeout(() => {
      setIsTyping(true);

      const typeNext = () => {
        if (indexRef.current < text.length) {
          const nextIndex = indexRef.current + 1;
          setDisplayedText(text.slice(0, nextIndex));

          if (haptic && nextIndex % hapticInterval === 0) {
            HapticManager.typingTick();
          }

          indexRef.current = nextIndex;
          // Cap at 300 chars for performance — show rest instantly
          if (nextIndex >= 300 && nextIndex < text.length) {
            setDisplayedText(text);
            indexRef.current = text.length;
            setIsTyping(false);
            setIsComplete(true);
            onComplete?.();
            return;
          }
          timerRef.current = setTimeout(typeNext, speed);
        } else {
          setIsTyping(false);
          setIsComplete(true);
          onComplete?.();
        }
      };

      typeNext();
    }, startDelay);

    return () => {
      clearTimeout(startTimeout);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [text]);

  return { displayedText, isTyping, isComplete, reset };
}
