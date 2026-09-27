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

  getSpeedRate() {
    const saved = localStorage.getItem('tm_voice_speed');
    return saved ? parseFloat(saved) : 1.20; // Upgraded from 1.05 to brisk, natural 1.20x
  }

  setSpeedRate(rate) {
    const validRate = Math.min(Math.max(parseFloat(rate) || 1.2, 0.8), 1.6);
    localStorage.setItem('tm_voice_speed', validRate.toString());
    return validRate;
  }

  getBestVoice() {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    // Prefer high quality natural sounding English voices
    const preferred = voices.find(v => 
      (v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Zira') || v.name.includes('Premium')))
    ) || voices.find(v => v.lang === 'en-IN' || v.lang === 'en-US' || v.lang === 'en-GB') || voices.find(v => v.lang.startsWith('en'));

    return preferred || voices[0];
  }

  speak(text) {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();

      // Clean markdown, symbols, and currency for smooth natural audio pronunciation
      let cleanText = text
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/₹\s?([0-9,]+(\.[0-9]+)?)/g, '$1 rupees')
        .replace(/\$\s?([0-9,]+(\.[0-9]+)?)/g, '$1 dollars')
        .replace(/•/g, '')
        .replace(/[\u{1F300}-\u{1FAFF}]/gu, '') // strip emojis for speech
        .replace(/\n+/g, '. ')
        .trim();

      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = this.getSpeedRate(); // Brisk and natural (1.20x)
      utterance.pitch = 1.02;

      const bestVoice = this.getBestVoice();
      if (bestVoice) {
        utterance.voice = bestVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }

  stopSpeaking() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}
