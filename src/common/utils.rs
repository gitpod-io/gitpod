use anyhow::Result;
use uuid::Uuid;

pub fn generate_id() -> Uuid {
    Uuid::new_v4()
}

pub fn validate_email(email: &str) -> bool {
    email.contains('@') && email.contains('.')
}

pub async fn health_check() -> Result<()> {
    // Basic health check implementation
    Ok(())
}
