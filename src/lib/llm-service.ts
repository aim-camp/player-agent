import { invoke } from '@tauri-apps/api/tauri';

export type ProviderType = 'Local' | 'Cloud';
export type ModelStatus = 
  | 'NotDownloaded' 
  | { Downloading: number } 
  | 'Downloaded' 
  | 'Active' 
  | { Error: string };

export interface LLMProvider {
  id: string;
  name: string;
  provider_type: ProviderType;
  enabled: boolean;
  model_name: string;
  model_size_gb: number;
  model_path?: string;
  status: ModelStatus;
  config: ProviderConfig;
  requirements: Requirements;
}

export interface ProviderConfig {
  quantization?: string;
  context_length?: number;
  gpu_layers?: number;
  api_key?: string;
  endpoint?: string;
  max_tokens?: number;
}

export interface Requirements {
  min_ram_gb: number;
  min_vram_gb?: number;
  gpu_required: boolean;
  disk_space_gb: number;
}

export class LLMService {
  async getAllProviders(): Promise<LLMProvider[]> {
    try {
      return await invoke<LLMProvider[]>('llm_get_all_providers');
    } catch (error) {
      console.error('Failed to get providers:', error);
      return [];
    }
  }

  async getActiveProvider(): Promise<LLMProvider | null> {
    try {
      return await invoke<LLMProvider | null>('llm_get_active_provider');
    } catch (error) {
      console.error('Failed to get active provider:', error);
      return null;
    }
  }

  async setActiveProvider(providerId: string): Promise<void> {
    try {
      await invoke('llm_set_active_provider', { providerId });
    } catch (error) {
      console.error('Failed to set active provider:', error);
      throw error;
    }
  }

  async enableProvider(providerId: string, enabled: boolean): Promise<void> {
    try {
      await invoke('llm_enable_provider', { providerId, enabled });
    } catch (error) {
      console.error('Failed to enable/disable provider:', error);
      throw error;
    }
  }

  async updateProviderConfig(providerId: string, config: ProviderConfig): Promise<void> {
    try {
      await invoke('llm_update_config', { providerId, config });
    } catch (error) {
      console.error('Failed to update provider config:', error);
      throw error;
    }
  }

  async checkRequirements(providerId: string): Promise<string[]> {
    try {
      return await invoke<string[]>('llm_check_requirements', { providerId });
    } catch (error) {
      console.error('Failed to check requirements:', error);
      return [];
    }
  }

  async downloadModel(providerId: string, onProgress?: (progress: number) => void): Promise<void> {
    try {
      await invoke('llm_download_model', { providerId });
      // TODO: Implement progress tracking with events
    } catch (error) {
      console.error('Failed to download model:', error);
      throw error;
    }
  }

  async addCustomProvider(provider: Partial<LLMProvider>): Promise<void> {
    try {
      await invoke('llm_add_custom_provider', { provider });
    } catch (error) {
      console.error('Failed to add custom provider:', error);
      throw error;
    }
  }

  async removeProvider(providerId: string): Promise<void> {
    try {
      await invoke('llm_remove_provider', { providerId });
    } catch (error) {
      console.error('Failed to remove provider:', error);
      throw error;
    }
  }

  getStatusLabel(status: ModelStatus): string {
    if (typeof status === 'string') {
      switch (status) {
        case 'NotDownloaded':
          return 'Não descarregado';
        case 'Downloaded':
          return 'Descarregado';
        case 'Active':
          return 'Activo';
        default:
          return status;
      }
    } else if ('Downloading' in status) {
      return `A descarregar... ${Math.round(status.Downloading)}%`;
    } else if ('Error' in status) {
      return `Erro: ${status.Error}`;
    }
    return 'Desconhecido';
  }

  getProviderIcon(providerType: ProviderType): string {
    return providerType === 'Local' ? '💻' : '☁️';
  }

  formatSize(gb: number): string {
    if (gb === 0) return 'Cloud';
    if (gb < 1) return `${Math.round(gb * 1024)} MB`;
    return `${gb.toFixed(1)} GB`;
  }
}

export const llmService = new LLMService();
