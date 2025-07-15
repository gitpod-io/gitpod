use gitpod::common::{config::Config, types::*};
use gitpod::components::*;
use tokio_test;
use uuid::Uuid;

#[tokio::test]
async fn test_config_loading() {
    let config = Config::default();
    assert_eq!(config.server.host, "0.0.0.0");
    assert_eq!(config.server.port, 8080);
}

#[tokio::test]
async fn test_database_operations() {
    let config = Config::default();
    let db = database::Database::new(&config.database).await.unwrap();

    // Test user creation
    let user = db.create_user("test@example.com".to_string(), "Test User".to_string()).await.unwrap();
    assert_eq!(user.email, "test@example.com");
    assert_eq!(user.name, "Test User");

    // Test user retrieval
    let retrieved_user = db.get_user(user.id).await.unwrap();
    assert_eq!(retrieved_user.email, user.email);

    // Test user lookup by email
    let found_user = db.get_user_by_email("test@example.com").await.unwrap();
    assert_eq!(found_user.id, user.id);
}

#[tokio::test]
async fn test_workspace_manager() {
    let config = Config::default();
    let wm = workspace_manager::WorkspaceManager::new(&config.workspace).await.unwrap();

    let user_id = Uuid::new_v4();

    // Test workspace creation
    let workspace = wm.create_workspace(user_id, "test-workspace".to_string()).await.unwrap();
    assert_eq!(workspace.name, "test-workspace");
    assert_eq!(workspace.user_id, user_id);
    assert!(matches!(workspace.status, WorkspaceStatus::Creating));

    // Test workspace retrieval
    let retrieved_workspace = wm.get_workspace(workspace.id).await.unwrap();
    assert_eq!(retrieved_workspace.id, workspace.id);

    // Test workspace listing
    let workspaces = wm.list_workspaces(user_id).await;
    assert_eq!(workspaces.len(), 1);
    assert_eq!(workspaces[0].id, workspace.id);
}

#[tokio::test]
async fn test_service_lifecycle() {
    let config = Config::default();

    // Test service startup
    let services = start_services(&config).await.unwrap();

    // Test service shutdown
    shutdown_services(services).await.unwrap();
}

#[tokio::test]
async fn test_workspace_status_transition() {
    let config = Config::default();
    let wm = workspace_manager::WorkspaceManager::new(&config.workspace).await.unwrap();

    let user_id = Uuid::new_v4();
    let workspace = wm.create_workspace(user_id, "status-test".to_string()).await.unwrap();

    // Wait for status transition (simulated in workspace manager)
    tokio::time::sleep(tokio::time::Duration::from_secs(6)).await;

    let updated_workspace = wm.get_workspace(workspace.id).await.unwrap();
    assert!(matches!(updated_workspace.status, WorkspaceStatus::Running));
}
