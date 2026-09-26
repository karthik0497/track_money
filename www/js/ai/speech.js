// Track-Money: Voice Recognition & Web Speech API Engine
// Provides hands-free voice input and visual feedback for Android & Desktop

export class SpeechEngine {
  constructor(callbacks = {}) {
    this.callbacks = {
      onStart: callbacks.onStart || (() => {}),
      onResult: callbacks.onResult || (() => {}),
      onError: callbacks.onError || (() => {}),
      onEnd: callbacks.onEnd || (() => {})
    };

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.isSupported = !!SpeechRecognition;
    this.recognition = null;
    this.isListening = false;

    if (this.isSupported) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-IN'; // Default to Indian English with multi-accent support

      this.recognition.onstart = () => {
        this.isListening = true;
        this.callbacks.onStart();
      };

      this.recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        this.callbacks.onResult({
          transcript: finalTranscript || interimTranscript,
          isFinal: !!finalTranscript
        });
      };

      this.recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        this.isListening = false;
        this.callbacks.onError(event.error);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.callbacks.onEnd();
      };
    }
  }

  async requestPermission() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        localStorage.setItem('tm_mic_granted', 'true');
        return { success: true };
      } catch (err) {
        console.warn('Microphone permission request error:', err);
        return { success: false, error: err.message };
      }
    }
    return { success: true };
  }

  async start() {
    if (!this.isSupported) {
      this.callbacks.onError('speech_not_supported');
      return false;
    }

    // Proactively verify / request microphone permission
    await this.requestPermission();

    try {
      this.recognition.start();
      return true;
    } catch (e) {
      console.warn('Recognition start exception:', e);
      return false;
    }
  }

  stop() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
    this.isListening = false;
  }

  toggle() {
    if (this.isListening) {
      this.stop();
      return false;
    } else {
      return this.start();
    }
  }

  speak(text) {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }
}
