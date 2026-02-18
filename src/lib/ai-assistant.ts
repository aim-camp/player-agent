import { invoke } from '@tauri-apps/api/tauri';

export interface AIConfig {
  enabled: boolean;
  model_path: string;
  persona: 'Pro' | 'Coach' | 'Casual' | 'Techie';
  voice_enabled: boolean;
  auto_suggestions: boolean;
  learning_enabled: boolean;
  response_speed: 'Fast' | 'Balanced' | 'Thorough';
}

export interface Message {
  role: 'User' | 'Assistant' | 'System';
  content: string;
  timestamp: number;
  metadata?: {
    feature_id?: string;
    action_taken?: string;
    confidence?: number;
  };
}

export interface Feature {
  id: string;
  name: string;
  category: string;
  description: string;
  technical_details: string;
  impact: {
    fps_gain?: string;
    latency_reduction?: string;
    memory_impact?: string;
    requires_restart: boolean;
  };
  requirements: string[];
  warnings: string[];
}

export class AIAssistantService {
  private initialized = false;
  private onMessageCallback?: (message: Message) => void;

  async initialize(): Promise<string> {
    try {
      const result = await invoke<string>('init_ai_assistant');
      this.initialized = true;
      return result;
    } catch (error) {
      console.error('Failed to initialize AI Assistant:', error);
      throw error;
    }
  }

  async sendMessage(message: string): Promise<string> {
    if (!this.initialized) {
      throw new Error('AI Assistant not initialized. Call initialize() first.');
    }

    try {
      const response = await invoke<string>('ai_local_chat', { message });
      
      // Notify callback if set
      if (this.onMessageCallback) {
        this.onMessageCallback({
          role: 'Assistant',
          content: response,
          timestamp: Date.now(),
        });
      }

      return response;
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  async explainFeature(featureId: string): Promise<Feature> {
    try {
      const feature = await invoke<Feature>('ai_explain_feature', { featureId });
      return feature;
    } catch (error) {
      console.error('Failed to explain feature:', error);
      throw error;
    }
  }

  async getPersonalizedSuggestions(): Promise<string[]> {
    try {
      return await invoke<string[]>('ai_get_suggestions');
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      return [];
    }
  }

  async recordOptimization(featureId: string): Promise<void> {
    try {
      await invoke('ai_record_optimization', { featureId });
    } catch (error) {
      console.error('Failed to record optimization:', error);
    }
  }

  async recordSatisfaction(featureId: string, rating: number): Promise<void> {
    try {
      await invoke('ai_record_satisfaction', { featureId, rating });
    } catch (error) {
      console.error('Failed to record satisfaction:', error);
    }
  }

  async getConversationHistory(): Promise<Message[]> {
    try {
      return await invoke<Message[]>('ai_get_conversation_history');
    } catch (error) {
      console.error('Failed to get conversation history:', error);
      return [];
    }
  }

  async clearConversationHistory(): Promise<void> {
    try {
      await invoke('ai_clear_history');
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  }

  async updateConfig(config: Partial<AIConfig>): Promise<void> {
    try {
      await invoke('ai_update_config', { config });
    } catch (error) {
      console.error('Failed to update config:', error);
      throw error;
    }
  }

  async getConfig(): Promise<AIConfig> {
    try {
      return await invoke<AIConfig>('ai_get_config');
    } catch (error) {
      console.error('Failed to get config:', error);
      throw error;
    }
  }

  async searchFeatures(query: string): Promise<Feature[]> {
    try {
      return await invoke<Feature[]>('ai_search_features', { query });
    } catch (error) {
      console.error('Failed to search features:', error);
      return [];
    }
  }

  async processVoiceCommand(audioData: Float32Array): Promise<unknown> {
    try {
      const command = await invoke('ai_process_voice', {
        audioData: Array.from(audioData),
      });
      return JSON.parse(command as string);
    } catch (error) {
      console.error('Failed to process voice command:', error);
      throw error;
    }
  }

  onMessage(callback: (message: Message) => void): void {
    this.onMessageCallback = callback;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

// Singleton instance
export const aiAssistant = new AIAssistantService();
