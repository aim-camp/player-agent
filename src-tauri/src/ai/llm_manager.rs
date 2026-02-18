use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ProviderType {
    Local,  // PersonaPlex, Llama, etc running locally
    Cloud,  // Groq, OpenAI, etc via API
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ModelStatus {
    NotDownloaded,
    Downloading(f32), // progress percentage
    Downloaded,
    Active,
    Error(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LLMProvider {
    pub id: String,
    pub name: String,
    pub provider_type: ProviderType,
    pub enabled: bool,
    pub model_name: String,
    pub model_size_gb: f32,
    pub model_path: Option<PathBuf>,
    pub status: ModelStatus,
    pub config: ProviderConfig,
    pub requirements: Requirements,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    // For local models
    pub quantization: Option<String>, // "q4", "q5", "q8"
    pub context_length: Option<u32>,
    pub gpu_layers: Option<u32>,
    
    // For cloud models
    pub api_key: Option<String>,
    pub endpoint: Option<String>,
    pub max_tokens: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Requirements {
    pub min_ram_gb: u32,
    pub min_vram_gb: Option<u32>,
    pub gpu_required: bool,
    pub disk_space_gb: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub provider_id: String,
    pub progress: f32,
    pub downloaded_mb: f32,
    pub total_mb: f32,
    pub speed_mbps: f32,
}

pub struct LLMManager {
    providers: HashMap<String, LLMProvider>,
    active_provider_id: Option<String>,
    config_path: PathBuf,
    models_path: PathBuf,
}

impl LLMManager {
    pub fn new(config_path: PathBuf, models_path: PathBuf) -> Result<Self, String> {
        fs::create_dir_all(&config_path)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
        fs::create_dir_all(&models_path)
            .map_err(|e| format!("Failed to create models directory: {}", e))?;

        let mut manager = Self {
            providers: HashMap::new(),
            active_provider_id: None,
            config_path,
            models_path,
        };

        // Load saved configuration
        manager.load_config()?;

        // If no providers exist, initialize defaults
        if manager.providers.is_empty() {
            manager.initialize_default_providers();
        }

        Ok(manager)
    }

    fn initialize_default_providers(&mut self) {
        // PersonaPlex-7B (NVIDIA) - Local
        let personaplex = LLMProvider {
            id: "personaplex-7b".to_string(),
            name: "PersonaPlex 7B (NVIDIA)".to_string(),
            provider_type: ProviderType::Local,
            enabled: false,
            model_name: "nvidia/personaplex-7b-v1".to_string(),
            model_size_gb: 4.2,
            model_path: Some(self.models_path.join("personaplex-7b-q4.gguf")),
            status: ModelStatus::NotDownloaded,
            config: ProviderConfig {
                quantization: Some("q4".to_string()),
                context_length: Some(4096),
                gpu_layers: Some(35),
                api_key: None,
                endpoint: None,
                max_tokens: Some(2048),
            },
            requirements: Requirements {
                min_ram_gb: 8,
                min_vram_gb: Some(4),
                gpu_required: false, // Can run on CPU but slow
                disk_space_gb: 4.5,
            },
        };

        // Llama 3.2 3B - Local (lighter alternative)
        let llama_3b = LLMProvider {
            id: "llama-3.2-3b".to_string(),
            name: "Llama 3.2 3B".to_string(),
            provider_type: ProviderType::Local,
            enabled: false,
            model_name: "meta-llama/Llama-3.2-3B-Instruct".to_string(),
            model_size_gb: 2.0,
            model_path: Some(self.models_path.join("llama-3.2-3b-q4.gguf")),
            status: ModelStatus::NotDownloaded,
            config: ProviderConfig {
                quantization: Some("q4".to_string()),
                context_length: Some(8192),
                gpu_layers: Some(28),
                api_key: None,
                endpoint: None,
                max_tokens: Some(2048),
            },
            requirements: Requirements {
                min_ram_gb: 4,
                min_vram_gb: Some(2),
                gpu_required: false,
                disk_space_gb: 2.5,
            },
        };

        // Groq - Cloud (fastest)
        let groq = LLMProvider {
            id: "groq-llama".to_string(),
            name: "Groq (Cloud API)".to_string(),
            provider_type: ProviderType::Cloud,
            enabled: false,
            model_name: "llama-3.1-70b-versatile".to_string(),
            model_size_gb: 0.0, // Cloud, no download needed
            model_path: None,
            status: ModelStatus::Downloaded, // Always "available"
            config: ProviderConfig {
                quantization: None,
                context_length: Some(8192),
                gpu_layers: None,
                api_key: None, // User must provide
                endpoint: Some("https://api.groq.com/openai/v1/chat/completions".to_string()),
                max_tokens: Some(8000),
            },
            requirements: Requirements {
                min_ram_gb: 0,
                min_vram_gb: None,
                gpu_required: false,
                disk_space_gb: 0.0,
            },
        };

        // OpenAI Compatible - Cloud (user can configure)
        let openai = LLMProvider {
            id: "openai-compatible".to_string(),
            name: "OpenAI Compatible API".to_string(),
            provider_type: ProviderType::Cloud,
            enabled: false,
            model_name: "gpt-4".to_string(),
            model_size_gb: 0.0,
            model_path: None,
            status: ModelStatus::Downloaded,
            config: ProviderConfig {
                quantization: None,
                context_length: Some(8192),
                gpu_layers: None,
                api_key: None,
                endpoint: Some("https://api.openai.com/v1/chat/completions".to_string()),
                max_tokens: Some(4096),
            },
            requirements: Requirements {
                min_ram_gb: 0,
                min_vram_gb: None,
                gpu_required: false,
                disk_space_gb: 0.0,
            },
        };

        self.providers.insert(personaplex.id.clone(), personaplex);
        self.providers.insert(llama_3b.id.clone(), llama_3b);
        self.providers.insert(groq.id.clone(), groq);
        self.providers.insert(openai.id.clone(), openai);

        let _ = self.save_config();
    }

    pub fn get_all_providers(&self) -> Vec<LLMProvider> {
        self.providers.values().cloned().collect()
    }

    pub fn get_provider(&self, id: &str) -> Option<&LLMProvider> {
        self.providers.get(id)
    }

    pub fn get_active_provider(&self) -> Option<&LLMProvider> {
        self.active_provider_id
            .as_ref()
            .and_then(|id| self.providers.get(id))
    }

    pub fn set_active_provider(&mut self, provider_id: &str) -> Result<(), String> {
        if !self.providers.contains_key(provider_id) {
            return Err(format!("Provider '{}' not found", provider_id));
        }

        let provider = self.providers.get(provider_id).unwrap();
        
        if !provider.enabled {
            return Err("Provider is not enabled".to_string());
        }

        if provider.provider_type == ProviderType::Local {
            if provider.status != ModelStatus::Downloaded && provider.status != ModelStatus::Active {
                return Err("Model not downloaded".to_string());
            }
        }

        self.active_provider_id = Some(provider_id.to_string());
        let _ = self.save_config();
        Ok(())
    }

    pub fn enable_provider(&mut self, provider_id: &str, enabled: bool) -> Result<(), String> {
        let provider = self.providers
            .get_mut(provider_id)
            .ok_or_else(|| format!("Provider '{}' not found", provider_id))?;

        provider.enabled = enabled;
        
        // Update status
        if enabled && provider.status == ModelStatus::NotDownloaded {
            if provider.provider_type == ProviderType::Cloud {
                provider.status = ModelStatus::Downloaded;
            }
        }

        let _ = self.save_config();
        Ok(())
    }

    pub fn update_provider_config(
        &mut self,
        provider_id: &str,
        config: ProviderConfig,
    ) -> Result<(), String> {
        let provider = self.providers
            .get_mut(provider_id)
            .ok_or_else(|| format!("Provider '{}' not found", provider_id))?;

        provider.config = config;
        let _ = self.save_config();
        Ok(())
    }

    pub fn update_model_status(
        &mut self,
        provider_id: &str,
        status: ModelStatus,
    ) -> Result<(), String> {
        let provider = self.providers
            .get_mut(provider_id)
            .ok_or_else(|| format!("Provider '{}' not found", provider_id))?;

        provider.status = status;
        let _ = self.save_config();
        Ok(())
    }

    pub fn check_requirements(&self, provider_id: &str, system_info: &SystemInfo) -> Vec<String> {
        let mut issues = Vec::new();

        if let Some(provider) = self.providers.get(provider_id) {
            let req = &provider.requirements;

            if system_info.ram_gb < req.min_ram_gb {
                issues.push(format!(
                    "Insufficient RAM: {}GB available, {}GB required",
                    system_info.ram_gb, req.min_ram_gb
                ));
            }

            if let Some(min_vram) = req.min_vram_gb {
                if let Some(vram) = system_info.vram_gb {
                    if vram < min_vram {
                        issues.push(format!(
                            "Insufficient VRAM: {}GB available, {}GB required",
                            vram, min_vram
                        ));
                    }
                } else if req.gpu_required {
                    issues.push("No GPU detected but GPU is required".to_string());
                }
            }

            if system_info.free_disk_gb < req.disk_space_gb {
                issues.push(format!(
                    "Insufficient disk space: {:.1}GB available, {:.1}GB required",
                    system_info.free_disk_gb, req.disk_space_gb
                ));
            }
        }

        issues
    }

    pub fn add_custom_provider(&mut self, provider: LLMProvider) -> Result<(), String> {
        if self.providers.contains_key(&provider.id) {
            return Err("Provider ID already exists".to_string());
        }

        self.providers.insert(provider.id.clone(), provider);
        let _ = self.save_config();
        Ok(())
    }

    pub fn remove_provider(&mut self, provider_id: &str) -> Result<(), String> {
        if self.active_provider_id.as_ref() == Some(&provider_id.to_string()) {
            self.active_provider_id = None;
        }

        self.providers.remove(provider_id);
        let _ = self.save_config();
        Ok(())
    }

    fn save_config(&self) -> Result<(), String> {
        #[derive(Serialize)]
        struct Config {
            providers: Vec<LLMProvider>,
            active_provider_id: Option<String>,
        }

        let config = Config {
            providers: self.providers.values().cloned().collect(),
            active_provider_id: self.active_provider_id.clone(),
        };

        let json = serde_json::to_string_pretty(&config)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;

        fs::write(self.config_path.join("llm_config.json"), json)
            .map_err(|e| format!("Failed to write config: {}", e))?;

        Ok(())
    }

    fn load_config(&mut self) -> Result<(), String> {
        let config_file = self.config_path.join("llm_config.json");
        
        if !config_file.exists() {
            return Ok(());
        }

        #[derive(Deserialize)]
        struct Config {
            providers: Vec<LLMProvider>,
            active_provider_id: Option<String>,
        }

        let content = fs::read_to_string(&config_file)
            .map_err(|e| format!("Failed to read config: {}", e))?;

        let config: Config = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse config: {}", e))?;

        self.providers.clear();
        for provider in config.providers {
            self.providers.insert(provider.id.clone(), provider);
        }
        self.active_provider_id = config.active_provider_id;

        Ok(())
    }
}

#[derive(Debug, Clone)]
pub struct SystemInfo {
    pub ram_gb: u32,
    pub vram_gb: Option<u32>,
    pub free_disk_gb: f32,
    pub has_gpu: bool,
}
