use anyhow::Result;
use tracing::{info, warn};

mod common;
mod components;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    info!("Starting Gitpod platform");

    // Initialize core components
    let config = common::config::load_config().await?;

    // Start services
    let services = components::start_services(&config).await?;

    info!("Gitpod platform started successfully");

    // Wait for shutdown signal
    tokio::signal::ctrl_c().await?;

    info!("Shutting down Gitpod platform");
    components::shutdown_services(services).await?;

    Ok(())
}
