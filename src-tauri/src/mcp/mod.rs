//! MCP (Model Context Protocol) Server Module
//!
//! Provides MCP server functionality for IDE integration with Claude Code, Codex, VS Code, and Cursor.

pub mod ide_config;
pub mod server;
pub mod tools;

pub use server::run_mcp_server;
