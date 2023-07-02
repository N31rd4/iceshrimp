use serde::Deserialize;
use std::env;
use std::fs;
use urlencoding::encode;

use sea_orm_migration::prelude::*;

#[cfg(feature = "convert")]
mod vec_to_json;

#[tokio::main]
async fn main() {
    let cwd = env::current_dir().unwrap();
    let yml = fs::File::open(cwd.join("../../.config/default.yml"))
        .expect("Failed to open '.config/default.yml'");
    let config: Config = serde_yaml::from_reader(yml).expect("Failed to parse yaml");

    env::set_var(
        "DATABASE_URL",
        format!(
            "postgres://{}:{}@{}:{}/{}",
            config.db.user,
            encode(&config.db.pass),
            config.db.host,
            config.db.port,
            config.db.db,
        ),
    );

    cli::run_cli(migration::Migrator).await;

    #[cfg(feature = "convert")]
    vec_to_json::convert().await;
}

#[derive(Debug, PartialEq, Deserialize)]
#[serde(rename = "camelCase")]
pub struct Config {
    pub db: DbConfig,
}

#[derive(Debug, PartialEq, Deserialize)]
#[serde(rename = "camelCase")]
pub struct DbConfig {
    pub host: String,
    pub port: u32,
    pub db: String,
    pub user: String,
    pub pass: String,
}