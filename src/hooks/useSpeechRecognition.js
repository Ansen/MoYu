import { useState, useEffect, useCallback, useRef } from 'react';

export function useSpeechRecognition(options = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  
  const recognitionRef = useRef(null);
  const onFinalResultRef = useRef(options.onFinalResult);
  const shouldKeepListeningRef = useRef(false);
  const restartTimerRef = useRef(null);
  const fatalErrorRef = useRef(false);
  const silenceRestartCountRef = useRef(0);
  const isStartingRef = useRef(false);
  const interimTranscriptRef = useRef('');

  useEffect(() => {
    onFinalResultRef.current = options.onFinalResult;
  }, [options.onFinalResult]);

  const flushInterimTranscript = useCallback(() => {
    const leftover = interimTranscriptRef.current.trim();
    if (leftover && onFinalResultRef.current) {
      onFinalResultRef.current(leftover);
    }
    interimTranscriptRef.current = '';
    setTranscript('');
  }, []);

  const initFreshRecognition = useCallback(() => {
    const SpeechRecognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
    if (!SpeechRecognition) return null;

    // Clean up existing instance if any
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    const recognition = new SpeechRecognition();
    // Continuous mode allows continuous transcription while operator hands are busy keying
    recognition.continuous = true;
    recognition.interimResults = true;
    
    // Default to standard Mandarin
    recognition.lang = 'zh-CN';

    recognition.onstart = () => {
      isStartingRef.current = false;
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event) => {
      let interimChunk = '';
      let finalChunk = '';
      
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalChunk += event.results[i][0].transcript;
        } else {
          interimChunk += event.results[i][0].transcript;
        }
      }
      
      interimTranscriptRef.current = interimChunk;
      setTranscript(interimChunk);
      
      if (finalChunk.trim() && onFinalResultRef.current) {
        silenceRestartCountRef.current = 0;
        onFinalResultRef.current(finalChunk.trim());
      }
    };

    recognition.onerror = (event) => {
      console.warn("Speech recognition event error:", event.error);
      isStartingRef.current = false;
      
      // Non-fatal transient events (silence pause or manual abort)
      if (event.error === 'no-speech' || event.error === 'aborted') {
        // Keep listening flag alive; onend will smoothly restart if intended
        return;
      }

      // Fatal/blocking errors (network failure, permission denied, service unavailable, hardware missing)
      fatalErrorRef.current = true;
      shouldKeepListeningRef.current = false;
      clearTimeout(restartTimerRef.current);
      flushInterimTranscript();
      setError(event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      isStartingRef.current = false;
      // Seamless restart on pause for hands-free CW keying operators
      if (shouldKeepListeningRef.current && !fatalErrorRef.current) {
        flushInterimTranscript();
        if (silenceRestartCountRef.current >= 30) {
          shouldKeepListeningRef.current = false;
          setIsListening(false);
          return;
        }

        silenceRestartCountRef.current += 1;
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = setTimeout(() => {
          if (shouldKeepListeningRef.current && !fatalErrorRef.current) {
            try {
              const fresh = initFreshRecognition();
              if (fresh) {
                fresh.start();
              }
            } catch (e) {
              if (e.name !== 'InvalidStateError') {
                console.warn("Speech recognition restart catch:", e);
              }
            }
          }
        }, 150);
      } else {
        flushInterimTranscript();
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    return recognition;
  }, [flushInterimTranscript]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldKeepListeningRef.current = false;
      isStartingRef.current = false;
      clearTimeout(restartTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onstart = null;
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  const startListening = useCallback(async () => {
    if (isListening || isStartingRef.current) return;
    isStartingRef.current = true;
    interimTranscriptRef.current = '';
    setTranscript('');
    setError(null);
    fatalErrorRef.current = false;
    shouldKeepListeningRef.current = true;
    silenceRestartCountRef.current = 0;

    const SpeechRecognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition API is not supported in this environment.");
      isStartingRef.current = false;
      setError('not-supported');
      setIsListening(false);
      shouldKeepListeningRef.current = false;
      return;
    }

    // Proactively check mic permission; only prompt via getUserMedia on non-Windows environments if state is 'prompt'
    // Avoid opening/closing audio hardware track on Windows WebView2 where SpeechRecognition manages WASAPI capture directly
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const permStatus = await navigator.permissions.query({ name: 'microphone' });
        if (permStatus.state === 'denied') {
          isStartingRef.current = false;
          fatalErrorRef.current = true;
          shouldKeepListeningRef.current = false;
          setError('not-allowed');
          setIsListening(false);
          return;
        }
        const isWindows = typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent);
        if (!isWindows && permStatus.state === 'prompt' && navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(t => t.stop());
          // Allow audio hardware driver to release cleanly before speech engine starts
          await new Promise(r => setTimeout(r, 150));
        }
      } catch {
        // Fallback for environments without permissions.query
      }
    }

    // Guard against stopListening() called while awaiting permission query
    if (!shouldKeepListeningRef.current) {
      isStartingRef.current = false;
      return;
    }

    const recognition = initFreshRecognition();
    if (!recognition) {
      isStartingRef.current = false;
      return;
    }

    try {
      recognition.start();
    } catch (err) {
      console.warn("Initial speech start caught:", err);
      isStartingRef.current = false;
      if (err.name !== 'InvalidStateError') {
        setError(err.name || 'error');
        fatalErrorRef.current = true;
        shouldKeepListeningRef.current = false;
        setIsListening(false);
      }
    }
  }, [isListening, initFreshRecognition]);

  const stopListening = useCallback(() => {
    shouldKeepListeningRef.current = false;
    fatalErrorRef.current = false;
    isStartingRef.current = false;
    clearTimeout(restartTimerRef.current);
    flushInterimTranscript();
    setIsListening(false);
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      recognitionRef.current = null;
    }
  }, [flushInterimTranscript]);

  const isSupported = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  return {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    isSupported
  };
}
