import { aiAssistant, type Message } from './ai-assistant';
import { VoiceHandler } from './voice-handler';

export class ChatUIManager {
  private container: HTMLElement;
  private messagesContainer: HTMLElement;
  private inputField: HTMLInputElement;
  private sendButton: HTMLButtonElement;
  private voiceButton: HTMLButtonElement;
  private voiceHandler: VoiceHandler;
  private onCommandCallback?: (command: string) => void;

  constructor(containerId: string) {
    const element = document.getElementById(containerId);
    if (!element) {
      throw new Error(`Container #${containerId} not found`);
    }
    this.container = element;
    this.voiceHandler = new VoiceHandler();
    
    this.messagesContainer = document.createElement('div');
    this.inputField = document.createElement('input');
    this.sendButton = document.createElement('button');
    this.voiceButton = document.createElement('button');
    
    this.render();
    this.setupEventListeners();
  }

  private render(): void {
    this.container.innerHTML = '';
    this.container.className = 'ai-chat-container';

    // Header
    const header = document.createElement('div');
    header.className = 'ai-chat-header';
    header.innerHTML = `
      <div class="ai-chat-title">
        <span class="ai-icon">🤖</span>
        <span>AI Coach</span>
      </div>
      <div class="ai-status">
        <span class="status-indicator"></span>
        <span class="status-text">Ready</span>
      </div>
    `;

    // Messages area
    this.messagesContainer.className = 'ai-chat-messages';
    this.messagesContainer.innerHTML = `
      <div class="ai-welcome-message">
        <span class="ai-icon">🤖</span>
        <div class="message-content">
          <p><strong>Olá! Sou o teu AI Coach.</strong></p>
          <p>Posso ajudar-te a optimizar o teu sistema para CS2, explicar features, e responder às tuas questões.</p>
          <p class="hint">💡 Pressiona <kbd>Ctrl+Space</kbd> para usar voz</p>
        </div>
      </div>
    `;

    // Input area
    const inputContainer = document.createElement('div');
    inputContainer.className = 'ai-chat-input-container';

    this.inputField.type = 'text';
    this.inputField.className = 'ai-chat-input';
    this.inputField.placeholder = 'Escreve ou usa Ctrl+Space para falar...';

    this.voiceButton.className = 'ai-voice-button';
    this.voiceButton.innerHTML = '🎤';
    this.voiceButton.title = 'Ctrl+Space para push-to-talk';

    this.sendButton.className = 'ai-send-button';
    this.sendButton.innerHTML = '➤';
    this.sendButton.title = 'Enviar';

    inputContainer.appendChild(this.voiceButton);
    inputContainer.appendChild(this.inputField);
    inputContainer.appendChild(this.sendButton);

    // Assemble
    this.container.appendChild(header);
    this.container.appendChild(this.messagesContainer);
    this.container.appendChild(inputContainer);
  }

  private setupEventListeners(): void {
    // Send message
    this.sendButton.addEventListener('click', () => this.sendMessage());
    this.inputField.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendMessage();
      }
    });

    // Voice handler
    this.voiceHandler.onTranscript((text) => {
      this.inputField.value = text;
      this.sendMessage();
    });

    this.voiceHandler.onError((error) => {
      this.addSystemMessage(`Erro no microfone: ${error.message}`);
    });

    // Voice button visual feedback
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && e.ctrlKey) {
        this.voiceButton.classList.add('recording');
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.voiceButton.classList.remove('recording');
      }
    });
  }

  private async sendMessage(): Promise<void> {
    const message = this.inputField.value.trim();
    if (!message) return;

    // Clear input
    this.inputField.value = '';

    // Add user message to UI
    this.addMessage({
      role: 'User',
      content: message,
      timestamp: Date.now(),
    });

    // Show typing indicator
    this.showTypingIndicator();

    try {
      // Send to AI
      const response = await aiAssistant.sendMessage(message);
      
      // Remove typing indicator
      this.hideTypingIndicator();

      // Add AI response
      this.addMessage({
        role: 'Assistant',
        content: response,
        timestamp: Date.now(),
      });

      // Check if this is a command
      if (this.onCommandCallback) {
        this.onCommandCallback(message);
      }
    } catch (error) {
      this.hideTypingIndicator();
      this.addSystemMessage(`Erro: ${error}`);
    }
  }

  addMessage(message: Message): void {
    const messageEl = document.createElement('div');
    messageEl.className = `ai-message ai-message-${message.role.toLowerCase()}`;

    const icon = message.role === 'User' ? '👤' : '🤖';
    const time = new Date(message.timestamp).toLocaleTimeString('pt-PT', {
      hour: '2-digit',
      minute: '2-digit',
    });

    messageEl.innerHTML = `
      <div class="message-header">
        <span class="message-icon">${icon}</span>
        <span class="message-role">${message.role === 'User' ? 'Tu' : 'AI Coach'}</span>
        <span class="message-time">${time}</span>
      </div>
      <div class="message-content">${this.formatContent(message.content)}</div>
    `;

    this.messagesContainer.appendChild(messageEl);
    this.scrollToBottom();
  }

  private addSystemMessage(content: string): void {
    this.addMessage({
      role: 'System',
      content,
      timestamp: Date.now(),
    });
  }

  private showTypingIndicator(): void {
    const indicator = document.createElement('div');
    indicator.className = 'ai-typing-indicator';
    indicator.innerHTML = `
      <span class="message-icon">🤖</span>
      <div class="typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `;
    this.messagesContainer.appendChild(indicator);
    this.scrollToBottom();
  }

  private hideTypingIndicator(): void {
    const indicator = this.messagesContainer.querySelector('.ai-typing-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  private formatContent(content: string): string {
    // Simple markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  private scrollToBottom(): void {
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  async loadHistory(): Promise<void> {
    try {
      const history = await aiAssistant.getConversationHistory();
      history.forEach((msg) => this.addMessage(msg));
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  }

  async clearHistory(): Promise<void> {
    try {
      await aiAssistant.clearConversationHistory();
      this.messagesContainer.innerHTML = '';
      this.render();
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  }

  onCommand(callback: (command: string) => void): void {
    this.onCommandCallback = callback;
  }

  destroy(): void {
    this.voiceHandler.destroy();
  }
}
