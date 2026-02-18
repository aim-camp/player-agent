use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Feature {
    pub id: String,
    pub name: String,
    pub category: String,
    pub description: String,
    pub technical_details: String,
    pub impact: Impact,
    pub requirements: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Impact {
    pub fps_gain: Option<String>,
    pub latency_reduction: Option<String>,
    pub memory_impact: Option<String>,
    pub requires_restart: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareProfile {
    pub cpu: String,
    pub gpu: String,
    pub ram: String,
    pub recommendations: Vec<String>,
}

pub struct KnowledgeBase {
    features: HashMap<String, Feature>,
    hardware_profiles: Vec<HardwareProfile>,
    common_issues: HashMap<String, String>,
    data_path: PathBuf,
}

impl KnowledgeBase {
    pub fn new(data_path: PathBuf) -> Result<Self, String> {
        let mut kb = Self {
            features: HashMap::new(),
            hardware_profiles: Vec::new(),
            common_issues: HashMap::new(),
            data_path,
        };

        kb.load_data()?;
        Ok(kb)
    }

    fn load_data(&mut self) -> Result<(), String> {
        // Create data directory if it doesn't exist
        fs::create_dir_all(&self.data_path)
            .map_err(|e| format!("Failed to create knowledge base directory: {}", e))?;

        // Load features
        let features_path = self.data_path.join("features.json");
        if features_path.exists() {
            let data = fs::read_to_string(&features_path)
                .map_err(|e| format!("Failed to read features: {}", e))?;
            
            if let Ok(features) = serde_json::from_str::<Vec<Feature>>(&data) {
                for feature in features {
                    self.features.insert(feature.id.clone(), feature);
                }
            }
        } else {
            // Initialize with default features
            self.initialize_default_features();
            self.save_features()?;
        }

        // Load hardware profiles
        let hw_path = self.data_path.join("hardware.json");
        if hw_path.exists() {
            let data = fs::read_to_string(&hw_path)
                .map_err(|e| format!("Failed to read hardware profiles: {}", e))?;
            
            if let Ok(profiles) = serde_json::from_str(&data) {
                self.hardware_profiles = profiles;
            }
        }

        // Load common issues
        let issues_path = self.data_path.join("issues.json");
        if issues_path.exists() {
            let data = fs::read_to_string(&issues_path)
                .map_err(|e| format!("Failed to read issues: {}", e))?;
            
            if let Ok(issues) = serde_json::from_str(&data) {
                self.common_issues = issues;
            }
        }

        Ok(())
    }

    fn initialize_default_features(&mut self) {
        // Windows tweaks
        self.features.insert("disable_hpet".to_string(), Feature {
            id: "disable_hpet".to_string(),
            name: "Disable HPET".to_string(),
            category: "Windows".to_string(),
            description: "HPET é um timer antigo que força o CPU a verificá-lo constantemente. Desactivar reduz input lag.".to_string(),
            technical_details: "High Precision Event Timer (HPET) adiciona ~2-3ms de latência. CPUs modernos têm TSC (Time Stamp Counter) que é mais eficiente.".to_string(),
            impact: Impact {
                fps_gain: None,
                latency_reduction: Some("-2.5ms average".to_string()),
                memory_impact: None,
                requires_restart: true,
            },
            requirements: vec!["CPU com suporte TSC (todos os modernos)".to_string()],
            warnings: vec!["Requer restart".to_string()],
        });

        self.features.insert("hardware_gpu_scheduling".to_string(), Feature {
            id: "hardware_gpu_scheduling".to_string(),
            name: "Hardware-accelerated GPU Scheduling".to_string(),
            category: "Windows".to_string(),
            description: "Permite GPU gerir a sua própria memória directamente, reduzindo overhead do CPU.".to_string(),
            technical_details: "Windows 10 2004+ feature. GPU controla VRAM scheduling em vez do CPU fazer via kernel do Windows.".to_string(),
            impact: Impact {
                fps_gain: Some("+5-15 fps".to_string()),
                latency_reduction: Some("-1ms".to_string()),
                memory_impact: None,
                requires_restart: false,
            },
            requirements: vec!["Windows 10 2004+".to_string(), "GPU WDDM 2.7+".to_string()],
            warnings: vec![],
        });

        self.features.insert("disable_core_parking".to_string(), Feature {
            id: "disable_core_parking".to_string(),
            name: "Disable Core Parking".to_string(),
            category: "Windows".to_string(),
            description: "Mantém todos os cores do CPU activos em vez de adormecer os não usados.".to_string(),
            technical_details: "Core parking coloca cores CPU em C-states profundos. Acordá-los adiciona latência. Para gaming, melhor manter todos activos.".to_string(),
            impact: Impact {
                fps_gain: Some("+8-12 fps em CPUs 8+ cores".to_string()),
                latency_reduction: Some("-2-5ms".to_string()),
                memory_impact: None,
                requires_restart: false,
            },
            requirements: vec!["CPU multi-core (4+ cores)".to_string()],
            warnings: vec!["Aumenta consumo energia/temperatura".to_string()],
        });

        // Add more default features...
    }

    pub fn get_feature(&self, id: &str) -> Option<&Feature> {
        self.features.get(id)
    }

    pub fn search_features(&self, query: &str) -> Vec<&Feature> {
        let query_lower = query.to_lowercase();
        
        self.features
            .values()
            .filter(|f| {
                f.name.to_lowercase().contains(&query_lower)
                    || f.description.to_lowercase().contains(&query_lower)
                    || f.category.to_lowercase().contains(&query_lower)
            })
            .collect()
    }

    pub fn get_category_features(&self, category: &str) -> Vec<&Feature> {
        self.features
            .values()
            .filter(|f| f.category == category)
            .collect()
    }

    pub fn get_recommendations_for_hardware(&self, cpu: &str, gpu: &str) -> Vec<String> {
        // Simple matching for now - can be enhanced with fuzzy matching
        for profile in &self.hardware_profiles {
            if profile.cpu.contains(cpu) || profile.gpu.contains(gpu) {
                return profile.recommendations.clone();
            }
        }
        vec![]
    }

    pub fn get_solution(&self, issue: &str) -> Option<String> {
        self.common_issues.get(issue).cloned()
    }

    fn save_features(&self) -> Result<(), String> {
        let features_vec: Vec<&Feature> = self.features.values().collect();
        let json = serde_json::to_string_pretty(&features_vec)
            .map_err(|e| format!("Failed to serialize features: {}", e))?;
        
        fs::write(self.data_path.join("features.json"), json)
            .map_err(|e| format!("Failed to write features: {}", e))?;
        
        Ok(())
    }

    pub fn add_feature(&mut self, feature: Feature) {
        self.features.insert(feature.id.clone(), feature);
    }

    pub fn get_all_categories(&self) -> Vec<String> {
        let mut categories: Vec<String> = self.features
            .values()
            .map(|f| f.category.clone())
            .collect();
        
        categories.sort();
        categories.dedup();
        categories
    }
}
