use gitpod_installer::config::*;
use gitpod_installer::validate::*;
use tempfile::NamedTempFile;
use std::io::Write;

#[tokio::test]
async fn test_config_initialization() {
    let temp_file = NamedTempFile::new().unwrap();
    let config_path = temp_file.path().to_str().unwrap().to_string();

    // Remove the temp file so init_config can create it
    drop(temp_file);

    init_config(Some(config_path.clone())).await.unwrap();

    // Verify config file was created and is valid
    let config = load_config(&config_path).await.unwrap();
    assert_eq!(config.domain, "gitpod.example.com");
    assert!(config.database.in_cluster);
}

#[tokio::test]
async fn test_config_validation_success() {
    let mut temp_file = NamedTempFile::new().unwrap();
    let config_yaml = r#"
domain: "gitpod.mycompany.com"
certificate:
  kind: "cert-manager"
database:
  in_cluster: true
storage:
  kind: "s3"
  region: "us-west-2"
  bucket: "gitpod-storage"
workspace:
  runtime: "containerd"
  containerd_socket: "/run/containerd/containerd.sock"
"#;

    temp_file.write_all(config_yaml.as_bytes()).unwrap();
    let config_path = temp_file.path().to_str().unwrap();

    // Should pass validation
    validate_config(config_path).await.unwrap();
}

#[tokio::test]
async fn test_config_validation_failure() {
    let mut temp_file = NamedTempFile::new().unwrap();
    let invalid_config_yaml = r#"
domain: ""
certificate:
  kind: "invalid-kind"
database:
  in_cluster: false
storage:
  kind: "s3"
workspace:
  runtime: "invalid-runtime"
  containerd_socket: "relative/path"
"#;

    temp_file.write_all(invalid_config_yaml.as_bytes()).unwrap();
    let config_path = temp_file.path().to_str().unwrap();

    // Should fail validation
    let result = validate_config(config_path).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_config_rendering() {
    let mut temp_file = NamedTempFile::new().unwrap();
    let config_yaml = r#"
domain: "gitpod.test.com"
certificate:
  kind: "secret"
  name: "tls-cert"
database:
  in_cluster: true
storage:
  kind: "minio"
workspace:
  runtime: "containerd"
  containerd_socket: "/run/containerd/containerd.sock"
"#;

    temp_file.write_all(config_yaml.as_bytes()).unwrap();
    let config_path = temp_file.path().to_str().unwrap();

    let output_file = NamedTempFile::new().unwrap();
    let output_path = output_file.path().to_str().unwrap();

    render_config(config_path, Some(output_path.to_string())).await.unwrap();

    // Verify output file was created
    let rendered_content = tokio::fs::read_to_string(output_path).await.unwrap();
    assert!(rendered_content.contains("gitpod.test.com"));
    assert!(rendered_content.contains("ConfigMap"));
}
