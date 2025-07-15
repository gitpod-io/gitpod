use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::Path;
use tracing::info;

#[derive(Debug, Serialize, Deserialize)]
pub struct GitpodConfig {
    pub domain: String,
    pub certificate: CertificateConfig,
    pub database: DatabaseConfig,
    pub storage: StorageConfig,
    pub workspace: WorkspaceConfig,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CertificateConfig {
    pub kind: String,
    pub name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DatabaseConfig {
    pub in_cluster: bool,
    pub external_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StorageConfig {
    pub kind: String,
    pub region: Option<String>,
    pub bucket: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkspaceConfig {
    pub runtime: String,
    pub containerd_socket: String,
}

impl Default for GitpodConfig {
    fn default() -> Self {
        Self {
            domain: "gitpod.example.com".to_string(),
            certificate: CertificateConfig {
                kind: "secret".to_string(),
                name: Some("https-certificates".to_string()),
            },
            database: DatabaseConfig {
                in_cluster: true,
                external_url: None,
            },
            storage: StorageConfig {
                kind: "minio".to_string(),
                region: None,
                bucket: None,
            },
            workspace: WorkspaceConfig {
                runtime: "containerd".to_string(),
                containerd_socket: "/run/containerd/containerd.sock".to_string(),
            },
        }
    }
}

pub async fn init_config(config_path: Option<String>) -> Result<()> {
    let path = config_path.unwrap_or_else(|| "gitpod.yaml".to_string());

    if Path::new(&path).exists() {
        return Err(anyhow::anyhow!("Configuration file already exists: {}", path));
    }

    let config = GitpodConfig::default();
    let yaml = serde_yaml::to_string(&config)?;

    tokio::fs::write(&path, yaml).await?;
    info!("Configuration initialized: {}", path);

    Ok(())
}

pub async fn load_config(path: &str) -> Result<GitpodConfig> {
    let content = tokio::fs::read_to_string(path).await?;
    let config: GitpodConfig = serde_yaml::from_str(&content)?;
    Ok(config)
}

pub async fn render_config(config_path: &str, output_path: Option<String>) -> Result<()> {
    let config = load_config(config_path).await?;

    // Render Kubernetes manifests
    let manifests = render_kubernetes_manifests(&config)?;

    let output = output_path.unwrap_or_else(|| "manifests.yaml".to_string());
    tokio::fs::write(&output, manifests).await?;

    info!("Configuration rendered to: {}", output);
    Ok(())
}

fn render_kubernetes_manifests(config: &GitpodConfig) -> Result<String> {
    // Simplified manifest rendering
    let manifest = format!(
        r#"
apiVersion: v1
kind: ConfigMap
metadata:
  name: gitpod-config
  namespace: gitpod
data:
  domain: "{}"
  database.in_cluster: "{}"
  storage.kind: "{}"
  workspace.runtime: "{}"
"#,
        config.domain,
        config.database.in_cluster,
        config.storage.kind,
        config.workspace.runtime
    );

    Ok(manifest)
}
