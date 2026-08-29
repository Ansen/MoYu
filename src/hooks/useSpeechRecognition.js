import { useState, useEffect, useCallback, useRef } from 'react';

export function useSpeechRecognition(options = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const onFinalResultRef = useRef(options.onFinalResult);

  useEffect(() => {
    onFinalResultRef.current = options.onFinalResult;
  }, [options.onFinalResult]);

  useEffect(() => {
    // Initialize Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      // Continuous mode allows the user to pause and continue within the same session
      recognition.continuous = true;
      recognition.interimResults = true;
      
      // Default to standard Mandarin
      recognition.lang = 'zh-CN';

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
        setTranscript('');
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
          onFinalResultRef.current(finalChunk.trim());
        }
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        if (event.error !== 'no-speech') {
          setError(event.error);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      console.warn("Speech Recognition API is not supported in this browser.");
      setError('not-supported');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startListening = useCallback(async () => {
    if (isListening) return;
    setTranscript('');
    setError(null);

    // Proactively request mic stream to trigger system permission prompt on macOS / Windows if not yet granted
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
      } catch (permErr) {
        console.error("Microphone permission denied or device error:", permErr);
        setError('not-allowed');
        setIsListening(false);
        return;
      }
    }

    if (!recognitionRef.current) {
      console.warn("Speech Recognition API is not supported in this environment.");
      setError('not-supported');
      setIsListening(false);
      return;
    }

    try {
      recognitionRef.current.start();
    } catch (err) {
      console.error("Failed to start listening", err);
      if (err.name !== 'InvalidStateError') {
        setError(err.name || 'error');
      }
      setIsListening(false);
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  return {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    isSupported: !!recognitionRef.current
  };
}
