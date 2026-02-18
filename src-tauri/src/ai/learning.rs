use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPreferences {
    pub preferred_persona: String,
    pub favorite_features: Vec<String>,
    pub ignored_suggestions: Vec<String>,
    pub applied_optimizations: Vec<String>,
    pub interaction_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MachineProfile {
    pub cpu: String,
    pub gpu: String,
    pub ram_gb: u32,
    pub os_version: String,
    pub performance_baseline: Option<PerformanceMetrics>,
    pub optimization_history: Vec<OptimizationEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub avg_fps: f32,
    pub one_percent_lows: f32,
    pub avg_latency_ms: f32,
    pub cpu_usage: f32,
    pub gpu_usage: f32,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationEvent {
    pub feature_id: String,
    pub applied_at: i64,
    pub before_metrics: Option<PerformanceMetrics>,
    pub after_metrics: Option<PerformanceMetrics>,
    pub user_satisfaction: Option<u8>, // 1-5 rating
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LearningData {
    pub user_prefs: UserPreferences,
    pub machine: MachineProfile,
    pub suggestion_effectiveness: HashMap<String, f32>, // feature_id -> success rate
    pub conversation_patterns: Vec<String>,
}

pub struct LearningSystem {
    data: LearningData,
    data_path: PathBuf,
}

impl LearningSystem {
    pub fn new(data_path: PathBuf) -> Result<Self, String> {
        fs::create_dir_all(&data_path)
            .map_err(|e| format!("Failed to create learning directory: {}", e))?;

        let data_file = data_path.join("learning_data.json");
        
        let data = if data_file.exists() {
            let content = fs::read_to_string(&data_file)
                .map_err(|e| format!("Failed to read learning data: {}", e))?;
            
            serde_json::from_str(&content)
                .unwrap_or_else(|_| Self::default_learning_data())
        } else {
            Self::default_learning_data()
        };

        Ok(Self { data, data_path })
    }

    fn default_learning_data() -> LearningData {
        LearningData {
            user_prefs: UserPreferences {
                preferred_persona: "Coach".to_string(),
                favorite_features: Vec::new(),
                ignored_suggestions: Vec::new(),
                applied_optimizations: Vec::new(),
                interaction_count: 0,
            },
            machine: MachineProfile {
                cpu: String::new(),
                gpu: String::new(),
                ram_gb: 0,
                os_version: String::new(),
                performance_baseline: None,
                optimization_history: Vec::new(),
            },
            suggestion_effectiveness: HashMap::new(),
            conversation_patterns: Vec::new(),
        }
    }

    pub fn update_machine_profile(&mut self, cpu: String, gpu: String, ram_gb: u32, os: String) {
        self.data.machine.cpu = cpu;
        self.data.machine.gpu = gpu;
        self.data.machine.ram_gb = ram_gb;
        self.data.machine.os_version = os;
    }

    pub fn record_optimization(&mut self, feature_id: String) {
        if !self.data.user_prefs.applied_optimizations.contains(&feature_id) {
            self.data.user_prefs.applied_optimizations.push(feature_id.clone());
        }

        let event = OptimizationEvent {
            feature_id: feature_id.clone(),
            applied_at: chrono::Utc::now().timestamp(),
            before_metrics: None,
            after_metrics: None,
            user_satisfaction: None,
        };

        self.data.machine.optimization_history.push(event);
        
        let _ = self.save();
    }

    pub fn record_performance_metrics(&mut self, metrics: PerformanceMetrics) {
        if self.data.machine.performance_baseline.is_none() {
            self.data.machine.performance_baseline = Some(metrics.clone());
        }

        // Update the last optimization event with after metrics
        if let Some(last_event) = self.data.machine.optimization_history.last_mut() {
            if last_event.after_metrics.is_none() {
                last_event.after_metrics = Some(metrics);
            }
        }

        let _ = self.save();
    }

    pub fn record_satisfaction(&mut self, feature_id: &str, rating: u8) {
        // Find the optimization event and update satisfaction
        for event in self.data.machine.optimization_history.iter_mut().rev() {
            if event.feature_id == feature_id && event.user_satisfaction.is_none() {
                event.user_satisfaction = Some(rating);
                break;
            }
        }

        // Update effectiveness score
        let current = self.data.suggestion_effectiveness
            .get(feature_id)
            .unwrap_or(&0.5);
        
        let new_score = (current + (rating as f32 / 5.0)) / 2.0;
        self.data.suggestion_effectiveness.insert(feature_id.to_string(), new_score);

        let _ = self.save();
    }

    pub fn add_favorite(&mut self, feature_id: String) {
        if !self.data.user_prefs.favorite_features.contains(&feature_id) {
            self.data.user_prefs.favorite_features.push(feature_id);
            let _ = self.save();
        }
    }

    pub fn ignore_suggestion(&mut self, feature_id: String) {
        if !self.data.user_prefs.ignored_suggestions.contains(&feature_id) {
            self.data.user_prefs.ignored_suggestions.push(feature_id);
            let _ = self.save();
        }
    }

    pub fn increment_interaction(&mut self) {
        self.data.user_prefs.interaction_count += 1;
        
        // Save every 10 interactions
        if self.data.user_prefs.interaction_count % 10 == 0 {
            let _ = self.save();
        }
    }

    pub fn get_personalized_suggestions(&self) -> Vec<String> {
        let mut suggestions = Vec::new();

        // Filter out already applied and ignored
        for (feature_id, effectiveness) in &self.data.suggestion_effectiveness {
            if !self.data.user_prefs.applied_optimizations.contains(feature_id)
                && !self.data.user_prefs.ignored_suggestions.contains(feature_id)
                && *effectiveness > 0.6
            {
                suggestions.push(feature_id.clone());
            }
        }

        // Sort by effectiveness
        suggestions.sort_by(|a, b| {
            let a_score = self.data.suggestion_effectiveness.get(a).unwrap_or(&0.5);
            let b_score = self.data.suggestion_effectiveness.get(b).unwrap_or(&0.5);
            b_score.partial_cmp(a_score).unwrap()
        });

        suggestions
    }

    pub fn get_performance_trend(&self) -> Option<f32> {
        if self.data.machine.optimization_history.len() < 2 {
            return None;
        }

        let mut improvements = Vec::new();
        
        for event in &self.data.machine.optimization_history {
            if let (Some(before), Some(after)) = (&event.before_metrics, &event.after_metrics) {
                let fps_improvement = (after.avg_fps - before.avg_fps) / before.avg_fps;
                improvements.push(fps_improvement);
            }
        }

        if improvements.is_empty() {
            return None;
        }

        let avg_improvement: f32 = improvements.iter().sum::<f32>() / improvements.len() as f32;
        Some(avg_improvement * 100.0) // Return as percentage
    }

    pub fn get_user_preferences(&self) -> &UserPreferences {
        &self.data.user_prefs
    }

    pub fn get_machine_profile(&self) -> &MachineProfile {
        &self.data.machine
    }

    pub fn record_conversation_pattern(&mut self, pattern: String) {
        self.data.conversation_patterns.push(pattern);
        
        // Keep only last 100 patterns
        if self.data.conversation_patterns.len() > 100 {
            self.data.conversation_patterns.drain(..10);
        }
    }

    pub fn save(&self) -> Result<(), String> {
        let json = serde_json::to_string_pretty(&self.data)
            .map_err(|e| format!("Failed to serialize learning data: {}", e))?;
        
        fs::write(self.data_path.join("learning_data.json"), json)
            .map_err(|e| format!("Failed to write learning data: {}", e))?;
        
        Ok(())
    }

    pub fn export_anonymized_data(&self) -> Result<String, String> {
        // Create anonymized version for potential federated learning
        let anonymized = LearningData {
            user_prefs: UserPreferences {
                preferred_persona: self.data.user_prefs.preferred_persona.clone(),
                favorite_features: Vec::new(), // Don't export personal favorites
                ignored_suggestions: Vec::new(),
                applied_optimizations: self.data.user_prefs.applied_optimizations.clone(),
                interaction_count: 0,
            },
            machine: MachineProfile {
                cpu: "anonymized".to_string(),
                gpu: "anonymized".to_string(),
                ram_gb: self.data.machine.ram_gb,
                os_version: self.data.machine.os_version.clone(),
                performance_baseline: None,
                optimization_history: Vec::new(),
            },
            suggestion_effectiveness: self.data.suggestion_effectiveness.clone(),
            conversation_patterns: Vec::new(),
        };

        serde_json::to_string_pretty(&anonymized)
            .map_err(|e| format!("Failed to serialize anonymized data: {}", e))
    }
}

impl Drop for LearningSystem {
    fn drop(&mut self) {
        let _ = self.save();
    }
}
