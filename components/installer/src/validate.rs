use anyhow::Result;
use tracing::{info, warn, error};
use crate::config::{load_config, GitpodConfig};

pub async fn validate_config(config_path: &str) -> Result<()> {
    info!("Validating configuration: {}", config_path);

    let config = load_config(config_path).await?;

    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    // Validate domain
    validate_domain(&config.domain, &mut errors, &mut warnings);

    // Validate database configuration
    validate_database(&config.database, &mut errors, &mut warnings);

    // Validate storage configuration
    validate_storage(&config.storage, &mut errors, &mut warnings);

    // Validate workspace configuration
    validate_workspace(&config.workspace, &mut errors, &mut warnings);

    // Validate certificate configuration
    validate_certificates(&config.certificate, &mut errors, &mut warnings);

    // Report warnings
    for warning in warnings {
        warn!("{}", warning);
    }

    // Report errors
    if !errors.is_empty() {
        for error in &errors {
            error!("{}", error);
        }
        return Err(anyhow::anyhow!("Configuration validation failed with {} errors", errors.len()));
    }

    info!("Configuration validation passed");
    Ok(())
}

fn validate_domain(domain: &str, errors: &mut Vec<String>, warnings: &mut Vec<String>) {
    if domain.is_empty() {
        errors.push("Domain cannot be empty".to_string());
        return;
    }

    if domain == "gitpod.example.com" {
        warnings.push("Using example domain - please configure a real domain".to_string());
    }

    if !domain.contains('.') {
        errors.push("Domain must be a valid FQDN".to_string());
    }

    if domain.starts_with("http://") || domain.starts_with("https://") {
        errors.push("Domain should not include protocol (http/https)".to_string());
    }
}

fn validate_database(db: &crate::config::DatabaseConfig, errors: &mut Vec<String>, warnings: &mut Vec<String>) {
    if !db.in_cluster && db.external_url.is_none() {
        errors.push("External database URL must be provided when in_cluster is false".to_string());
    }

    if db.in_cluster && db.external_url.is_some() {
        warnings.push("External database URL is ignored when in_cluster is true".to_string());
    }

    if let Some(url) = &db.external_url {
        if !url.starts_with("postgresql://") && !url.starts_with("mysql://") {
            errors.push("Database URL must use postgresql:// or mysql:// scheme".to_string());
        }
    }
}

fn validate_storage(storage: &crate::config::StorageConfig, errors: &mut Vec<String>, warnings: &mut Vec<String>) {
    match storage.kind.as_str() {
        "minio" => {
            // MinIO validation
            if storage.region.is_some() {
                warnings.push("Region is not used with MinIO storage".to_string());
            }
        }
        "s3" => {
            // S3 validation
            if storage.region.is_none() {
                errors.push("Region is required for S3 storage".to_string());
            }
            if storage.bucket.is_none() {
                errors.push("Bucket is required for S3 storage".to_string());
            }
        }
        "gcs" => {
            // Google Cloud Storage validation
            if storage.bucket.is_none() {
                errors.push("Bucket is required for GCS storage".to_string());
            }
        }
        _ => {
            errors.push(format!("Unsupported storage kind: {}", storage.kind));
        }
    }
}

fn validate_workspace(workspace: &crate::config::WorkspaceConfig, errors: &mut Vec<String>, warnings: &mut Vec<String>) {
    match workspace.runtime.as_str() {
        "containerd" => {
            if !workspace.containerd_socket.starts_with("/") {
                errors.push("Containerd socket must be an absolute path".to_string());
            }
        }
        "docker" => {
            warnings.push("Docker runtime is deprecated, consider using containerd".to_string());
        }
        _ => {
            errors.push(format!("Unsupported workspace runtime: {}", workspace.runtime));
        }
    }
}

fn validate_certificates(cert: &crate::config::CertificateConfig, errors: &mut Vec<String>, warnings: &mut Vec<String>) {
    match cert.kind.as_str() {
        "secret" => {
            if cert.name.is_none() {
                errors.push("Certificate name is required for secret kind".to_string());
            }
        }
        "cert-manager" => {
            // cert-manager validation
        }
        "letsencrypt" => {
            warnings.push("Let's Encrypt certificates have rate limits".to_string());
        }
        _ => {
            errors.push(format!("Unsupported certificate kind: {}", cert.kind));
        }
    }
}
