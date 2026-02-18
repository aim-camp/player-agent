export class VoiceHandler {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private isRecording = false;
  private audioChunks: Blob[] = [];
  private onTranscriptCallback?: (text: string) => void;
  private onErrorCallback?: (error: Error) => void;

  private hotkey = 'Control+Space';
  private hotkeyPressed = false;

  constructor() {
    this.setupHotkeyListener();
  }

  private setupHotkeyListener(): void {
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && e.ctrlKey && !this.hotkeyPressed) {
        e.preventDefault();
        this.hotkeyPressed = true;
        this.startRecording().catch(console.error);
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.code === 'Space' && this.hotkeyPressed) {
        e.preventDefault();
        this.hotkeyPressed = false;
        this.stopRecording().catch(console.error);
      }
    });
  }

  async startRecording(): Promise<void> {
    if (this.isRecording) return;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      this.audioContext = new AudioContext({ sampleRate: 16000 });
      this.mediaRecorder = new MediaRecorder(this.stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        await this.processRecording();
      };

      this.mediaRecorder.start();
      this.isRecording = true;

      console.log('🎤 Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(error as Error);
      }
    }
  }

  async stopRecording(): Promise<void> {
    if (!this.isRecording || !this.mediaRecorder) return;

    this.mediaRecorder.stop();
    this.isRecording = false;

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }

    console.log('🎤 Recording stopped');
  }

  private async processRecording(): Promise<void> {
    if (this.audioChunks.length === 0) return;

    try {
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
      const audioData = await this.blobToFloat32Array(audioBlob);

      // In a real implementation, this would call the Whisper model
      // For now, we'll simulate transcription
      const transcript = await this.simulateTranscription();

      if (this.onTranscriptCallback) {
        this.onTranscriptCallback(transcript);
      }
    } catch (error) {
      console.error('Failed to process recording:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(error as Error);
      }
    }
  }

  private async blobToFloat32Array(blob: Blob): Promise<Float32Array> {
    const arrayBuffer = await blob.arrayBuffer();
    
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: 16000 });
    }

    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    return audioBuffer.getChannelData(0);
  }

  private async simulateTranscription(): Promise<string> {
    // Placeholder - in production, this would send audio to Whisper
    return "optimize my system for cs2";
  }

  onTranscript(callback: (text: string) => void): void {
    this.onTranscriptCallback = callback;
  }

  onError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback;
  }

  isActive(): boolean {
    return this.isRecording;
  }

  setHotkey(hotkey: string): void {
    this.hotkey = hotkey;
  }

  destroy(): void {
    if (this.isRecording) {
      this.stopRecording();
    }
    
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}

// Helper to check microphone permissions
export async function checkMicrophonePermission(): Promise<boolean> {
  try {
    const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return result.state === 'granted';
  } catch {
    // Fallback: try to get stream
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch {
      return false;
    }
  }
}
