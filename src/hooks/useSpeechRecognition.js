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

  useEffect(() => {
    onFinalResultRef.current = options.onFinalResult;
  }, [options.onFinalResult]);

  useEffect(() => {
    // Initialize Speech Recognition (with standard or webkit vendor prefix)
    const SpeechRecognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
    
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      // Continuous mode allows continuous transcription
      recognition.continuous = true;
      recognition.interimResults = true;
      
      // Default to standard Mandarin
      recognition.lang = 'zh-CN';

      recognition.onstart = () => {
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
        
        setTranscript(interimChunk);
        
        if (finalChunk.trim() && onFinalResultRef.current) {
          silenceRestartCountRef.current = 0;
          onFinalResultRef.current(finalChunk.trim());
        }
      };

      recognition.onerror = (event) => {
        console.warn("Speech recognition event error:", event.error);
        
        // Fatal errors: Stop listening and do not auto-restart
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          fatalErrorRef.current = true;
          shouldKeepListeningRef.current = false;
          setError(event.error);
          setIsListening(false);
          return;
        }

        // Non-fatal transient errors (silence, aborted, network hiccups)
        if (event.error === 'no-speech' || event.error === 'aborted') {
          // Keep listening flag alive; onend will smoothly restart if intended
          return;
        }

        setError(event.error);
      };

      recognition.onend = () => {
        // WebKit / macOS WKWebView triggers onend upon silence even with continuous=true.
        // If user didn't explicitly click stop and no fatal error occurred, seamlessly restart.
        // Cap continuous idle restarts (e.g. 20 times ~ 40s silence) to conserve system resources.
        if (shouldKeepListeningRef.current && !fatalErrorRef.current) {
          if (silenceRestartCountRef.current >= 20) {
            shouldKeepListeningRef.current = false;
            setIsListening(false);
            return;
          }

          silenceRestartCountRef.current += 1;
          clearTimeout(restartTimerRef.current);
          restartTimerRef.current = setTimeout(() => {
            if (shouldKeepListeningRef.current && !fatalErrorRef.current && recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch (e) {
                if (e.name !== 'InvalidStateError') {
                  console.warn("Speech recognition restart catch:", e);
                }
              }
            }
          }, 100);
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
    } else {
      console.warn("Speech Recognition API is not supported in this browser/webview.");
      setError('not-supported');
    }

    return () => {
      shouldKeepListeningRef.current = false;
      clearTimeout(restartTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const startListening = useCallback(async () => {
    if (isListening) return;
    setTranscript('');
    setError(null);
    fatalErrorRef.current = false;
    shouldKeepListeningRef.current = true;
    silenceRestartCountRef.current = 0;

    // Proactively request mic stream to trigger system permission prompt on macOS / Windows if not yet granted
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
      } catch (permErr) {
        console.error("Microphone permission denied or device error:", permErr);
        fatalErrorRef.current = true;
        shouldKeepListeningRef.current = false;
        setError('not-allowed');
        setIsListening(false);
        return;
      }
    }

    if (!recognitionRef.current) {
      console.warn("Speech Recognition API is not supported in this environment.");
      setError('not-supported');
      setIsListening(false);
      shouldKeepListeningRef.current = false;
      return;
    }

    try {
      recognitionRef.current.start();
    } catch (err) {
      console.warn("Initial speech start caught:", err);
      if (err.name !== 'InvalidStateError') {
        setError(err.name || 'error');
        fatalErrorRef.current = true;
        shouldKeepListeningRef.current = false;
        setIsListening(false);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    shouldKeepListeningRef.current = false;
    fatalErrorRef.current = false;
    clearTimeout(restartTimerRef.current);
    setIsListening(false);
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
  }, []);

  return {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    isSupported: !!recognitionRef.current
  };
}
