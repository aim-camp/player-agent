// AI Assistant module - Voice assistant with PersonaPlex-7B-v1
pub mod assistant;
pub mod knowledge;
pub mod learning;
pub mod voice;
pub mod llm_manager;

pub use assistant::AIAssistant;
pub use knowledge::KnowledgeBase;
pub use learning::LearningSystem;
pub use voice::VoiceHandler;
pub use llm_manager::LLMManager;
