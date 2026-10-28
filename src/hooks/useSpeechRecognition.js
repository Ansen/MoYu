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
  const lastFinalChunkRef = useRef('');

  useEffect(() => {
    onFinalResultRef.current = options.onFinalResult;
  }, [options.onFinalResult]);

  const flushInterimTranscript = useCallback(() => {
    const leftover = interimTranscriptRef.current.trim();
    if (leftover && leftover !== lastFinalChunkRef.current && onFinalResultRef.current) {
      lastFinalChunkRef.current = leftover;
      onFinalResultRef.current(leftover);
    }
    interimTranscriptRef.current = '';
    setTranscript('');
  }, []);

  const detachAndAbort = useCallback((instance) => {
    if (!instance) return;
    try {
      instance.onstart = null;
      instance.onresult = null;
      instance.onerror = null;
      instance.onend = null;
      instance.abort();
    } catch {
      // ignore
    }
  }, []);

  const initFreshRecognition = useCallback(() => {
    const SpeechRecognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
    if (!SpeechRecognition) return null;

    // Clean up existing instance if any
    if (recognitionRef.current) {
      detachAndAbort(recognitionRef.current);
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
      
      const trimmedFinal = finalChunk.trim();
      if (trimmedFinal && onFinalResultRef.current) {
        silenceRestartCountRef.current = 0;
        // Guard against Safari / WKWebView emitting duplicate consecutive isFinal chunks
        if (trimmedFinal !== lastFinalChunkRef.current) {
          lastFinalChunkRef.current = trimmedFinal;
          onFinalResultRef.current(trimmedFinal);
        }
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
      // Seamless restart on pause for hands-free CW keying operators (especially on macOS WKWebView)
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
              lastFinalChunkRef.current = '';
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
  }, [detachAndAbort, flushInterimTranscript]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldKeepListeningRef.current = false;
      isStartingRef.current = false;
      clearTimeout(restartTimerRef.current);
      if (recognitionRef.current) {
        detachAndAbort(recognitionRef.current);
        recognitionRef.current = null;
      }
    };
  }, [detachAndAbort]);

  const startListening = useCallback(() => {
    if (isListening || isStartingRef.current) return;
    isStartingRef.current = true;
    interimTranscriptRef.current = '';
    lastFinalChunkRef.current = '';
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

    const recognition = initFreshRecognition();
    if (!recognition) {
      isStartingRef.current = false;
      return;
    }

    // Invoke recognition.start() synchronously within the user click gesture.
    // This preserves WebKit UserGestureIndicator on macOS/iOS WKWebView and avoids
    // CoreAudio / WASAPI hardware lock contention caused by pre-opening getUserMedia.
    try {
      recognition.start();
    } catch (err) {
      console.warn("Initial speech start caught:", err);
      isStartingRef.current = false;
      if (err.name !== 'InvalidStateError') {
        setError(err.name === 'NotAllowedError' ? 'not-allowed' : (err.name || 'error'));
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
      detachAndAbort(recognitionRef.current);
      recognitionRef.current = null;
    }
  }, [detachAndAbort, flushInterimTranscript]);

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
