use anyhow::Result;
use clap::{Parser, Subcommand};
use tracing::{info, error};

mod config;
mod install;
mod validate;

#[derive(Parser)]
#[command(name = "gitpod-installer")]
#[command(about = "Installs Gitpod")]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    #[arg(long, default_value = "info")]
    log_level: String,

    #[arg(long)]
    debug_version_file: Option<String>,

    #[arg(long, default_value = "true")]
    strict_parse: bool,
}

#[derive(Subcommand)]
enum Commands {
    /// Initialize Gitpod configuration
    Init {
        #[arg(short, long)]
        config: Option<String>,
    },
    /// Install Gitpod
    Install {
        #[arg(short, long)]
        config: String,
    },
    /// Validate configuration
    Validate {
        #[arg(short, long)]
        config: String,
    },
    /// Render configuration
    Render {
        #[arg(short, long)]
        config: String,
        #[arg(short, long)]
        output: Option<String>,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    // Initialize logging
    tracing_subscriber::fmt()
        .with_max_level(parse_log_level(&cli.log_level)?)
        .init();

    match cli.command {
        Commands::Init { config } => {
            info!("Initializing Gitpod configuration");
            config::init_config(config).await?;
        }
        Commands::Install { config } => {
            info!("Installing Gitpod with config: {}", config);
            install::install_gitpod(&config).await?;
        }
        Commands::Validate { config } => {
            info!("Validating configuration: {}", config);
            validate::validate_config(&config).await?;
        }
        Commands::Render { config, output } => {
            info!("Rendering configuration: {}", config);
            config::render_config(&config, output).await?;
        }
    }

    Ok(())
}

fn parse_log_level(level: &str) -> Result<tracing::Level> {
    match level.to_lowercase().as_str() {
        "trace" => Ok(tracing::Level::TRACE),
        "debug" => Ok(tracing::Level::DEBUG),
        "info" => Ok(tracing::Level::INFO),
        "warn" => Ok(tracing::Level::WARN),
        "error" => Ok(tracing::Level::ERROR),
        _ => Err(anyhow::anyhow!("Invalid log level: {}", level)),
    }
}
