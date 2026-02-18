use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::path::PathBuf;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIConfig {
    pub enabled: bool,
    pub model_path: PathBuf,
    pub persona: Persona,
    pub voice_enabled: bool,
    pub auto_suggestions: bool,
    pub learning_enabled: bool,
    pub response_speed: ResponseSpeed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Persona {
    Pro,      // Professional, data-driven
    Coach,    // Friendly, encouraging
    Casual,   // Relaxed, simple
    Techie,   // Enthusiastic, technical
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ResponseSpeed {
    Fast,    // Less context, quicker responses
    Balanced, // Default
    Thorough, // More context, detailed
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: Role,
    pub content: String,
    pub timestamp: i64,
    pub metadata: Option<MessageMetadata>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Role {
    User,
    Assistant,
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageMetadata {
    pub feature_id: Option<String>,
    pub action_taken: Option<String>,
    pub confidence: Option<f32>,
}

pub struct AIAssistant {
    config: Arc<RwLock<AIConfig>>,
    conversation_history: Arc<Mutex<Vec<Message>>>,
    model_loaded: Arc<Mutex<bool>>,
}

impl AIAssistant {
    pub fn new(config: AIConfig) -> Self {
        Self {
            config: Arc::new(RwLock::new(config)),
            conversation_history: Arc::new(Mutex::new(Vec::new())),
            model_loaded: Arc::new(Mutex::new(false)),
        }
    }

    pub async fn initialize(&self) -> Result<(), String> {
        // Load model in background thread
        let config = self.config.read().await;
        
        if !config.model_path.exists() {
            return Err("Model not found. Please download from settings.".to_string());
        }

        // TODO: Implement actual model loading with llama.cpp
        // For now, we'll simulate successful load
        let mut loaded = self.model_loaded.lock().unwrap();
        *loaded = true;

        Ok(())
    }

    pub fn add_message(&self, message: Message) {
        let mut history = self.conversation_history.lock().unwrap();
        history.push(message);
        
        // Keep only last 50 messages to manage memory
        if history.len() > 50 {
            history.drain(..10);
        }
    }

    pub async fn process_text(&self, input: String) -> Result<String, String> {
        {
            let loaded = self.model_loaded.lock().unwrap();
            if !*loaded {
                return Err("AI model not loaded".to_string());
            }
        }

        // Add user message to history
        self.add_message(Message {
            role: Role::User,
            content: input.clone(),
            timestamp: chrono::Utc::now().timestamp(),
            metadata: None,
        });

        // TODO: Implement actual LLM inference
        // For now, return a placeholder response
        let response = self.generate_response(&input).await?;

        // Add assistant response to history
        self.add_message(Message {
            role: Role::Assistant,
            content: response.clone(),
            timestamp: chrono::Utc::now().timestamp(),
            metadata: None,
        });

        Ok(response)
    }

    async fn generate_response(&self, _input: &str) -> Result<String, String> {
        // Placeholder - will be replaced with actual LLM call
        let config = self.config.read().await;
        
        let response = match config.persona {
            Persona::Pro => "Based on your hardware configuration, I recommend applying these optimizations.",
            Persona::Coach => "Hey! Let's get your system running smooth. Here's what I suggest.",
            Persona::Casual => "Yo, check this out - these tweaks should help.",
            Persona::Techie => "Alright! Let's dive into the technical details here.",
        };

        Ok(response.to_string())
    }

    pub fn get_history(&self) -> Vec<Message> {
        self.conversation_history.lock().unwrap().clone()
    }

    pub async fn clear_history(&self) {
        let mut history = self.conversation_history.lock().unwrap();
        history.clear();
    }

    pub async fn update_config(&self, new_config: AIConfig) {
        let mut config = self.config.write().await;
        *config = new_config;
    }

    pub async fn get_config(&self) -> AIConfig {
        self.config.read().await.clone()
    }
}

impl Default for AIConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            model_path: PathBuf::from("models/personaplex-7b-q4.gguf"),
            persona: Persona::Coach,
            voice_enabled: false,
            auto_suggestions: true,
            learning_enabled: true,
            response_speed: ResponseSpeed::Balanced,
        }
    }
}
