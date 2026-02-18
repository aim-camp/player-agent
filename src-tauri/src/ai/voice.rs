use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceConfig {
    pub enabled: bool,
    pub push_to_talk_key: String, // "Ctrl+Space"
    pub auto_listen: bool,
    pub voice_speed: f32, // 0.8 to 1.5
    pub tts_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum VoiceCommand {
    Optimize,
    ShowTab(String),
    Explain(String),
    ApplyFeature(String),
    PingServers,
    ShowHardware,
    ClearChat,
    Help,
    Unknown(String),
}

pub struct VoiceHandler {
    config: Arc<RwLock<VoiceConfig>>,
    is_listening: Arc<RwLock<bool>>,
}

impl VoiceHandler {
    pub fn new(config: VoiceConfig) -> Self {
        Self {
            config: Arc::new(RwLock::new(config)),
            is_listening: Arc::new(RwLock::new(false)),
        }
    }

    pub async fn start_listening(&self) -> Result<(), String> {
        let mut listening = self.is_listening.write().await;
        *listening = true;
        
        // TODO: Implement actual audio capture with Whisper
        // For now, return success
        Ok(())
    }

    pub async fn stop_listening(&self) -> Result<(), String> {
        let mut listening = self.is_listening.write().await;
        *listening = false;
        Ok(())
    }

    pub async fn is_listening(&self) -> bool {
        *self.is_listening.read().await
    }

    pub async fn process_audio(&self, _audio_data: Vec<f32>) -> Result<String, String> {
        // TODO: Implement Whisper.cpp integration for speech-to-text
        // Placeholder for now
        Ok("sample transcription".to_string())
    }

    pub fn parse_command(&self, text: &str) -> VoiceCommand {
        let text_lower = text.to_lowercase();

        if text_lower.contains("optimize") || text_lower.contains("otimiza") {
            return VoiceCommand::Optimize;
        }

        if text_lower.contains("ping") {
            return VoiceCommand::PingServers;
        }

        if text_lower.contains("hardware") || text_lower.contains("specs") {
            return VoiceCommand::ShowHardware;
        }

        if text_lower.contains("explain") || text_lower.contains("explica") ||
           text_lower.contains("what is") || text_lower.contains("o que é") {
            // Extract feature name
            let feature = self.extract_feature_name(&text);
            return VoiceCommand::Explain(feature);
        }

        if text_lower.contains("show") || text_lower.contains("open") ||
           text_lower.contains("mostra") || text_lower.contains("abre") {
            if text_lower.contains("cfg") || text_lower.contains("config") {
                return VoiceCommand::ShowTab("cfg".to_string());
            }
            if text_lower.contains("sys") || text_lower.contains("system") {
                return VoiceCommand::ShowTab("sys".to_string());
            }
            if text_lower.contains("network") || text_lower.contains("net") {
                return VoiceCommand::ShowTab("net".to_string());
            }
        }

        if text_lower.contains("enable") || text_lower.contains("apply") ||
           text_lower.contains("activate") || text_lower.contains("liga") {
            let feature = self.extract_feature_name(&text);
            return VoiceCommand::ApplyFeature(feature);
        }

        if text_lower.contains("clear") || text_lower.contains("limpa") {
            return VoiceCommand::ClearChat;
        }

        if text_lower.contains("help") || text_lower.contains("ajuda") {
            return VoiceCommand::Help;
        }

        VoiceCommand::Unknown(text.to_string())
    }

    fn extract_feature_name(&self, text: &str) -> String {
        // Simple extraction - can be improved with NLP
        let words: Vec<&str> = text.split_whitespace().collect();
        
        // Look for common feature keywords
        for (i, word) in words.iter().enumerate() {
            let word_lower = word.to_lowercase();
            if word_lower == "hpet" {
                return "disable_hpet".to_string();
            }
            if word_lower.contains("core") && i + 1 < words.len() {
                if words[i + 1].to_lowercase().contains("park") {
                    return "disable_core_parking".to_string();
                }
            }
            if word_lower.contains("gpu") && i + 1 < words.len() {
                if words[i + 1].to_lowercase().contains("schedul") {
                    return "hardware_gpu_scheduling".to_string();
                }
            }
        }

        "unknown".to_string()
    }

    pub async fn speak(&self, text: &str) -> Result<(), String> {
        let config = self.config.read().await;
        
        if !config.tts_enabled {
            return Ok(());
        }

        // TODO: Implement TTS with Piper or browser SpeechSynthesis
        // For now, just log
        println!("TTS: {}", text);
        Ok(())
    }

    pub async fn update_config(&self, new_config: VoiceConfig) {
        let mut config = self.config.write().await;
        *config = new_config;
    }

    pub async fn get_config(&self) -> VoiceConfig {
        self.config.read().await.clone()
    }
}

impl Default for VoiceConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            push_to_talk_key: "Ctrl+Space".to_string(),
            auto_listen: false,
            voice_speed: 1.0,
            tts_enabled: true,
        }
    }
}

// Helper to get voice command help text
pub fn get_voice_commands_help() -> Vec<(&'static str, &'static str)> {
    vec![
        ("optimize", "Run full optimization suite"),
        ("show [sys/cfg/net]", "Open specific tab"),
        ("explain [feature]", "Get explanation for a feature"),
        ("enable [feature]", "Apply a specific optimization"),
        ("ping servers", "Test network latency"),
        ("show hardware", "Display system specs"),
        ("clear chat", "Clear conversation history"),
        ("help", "Show available commands"),
    ]
}
