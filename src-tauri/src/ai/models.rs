//! Model catalogs per AI CLI, read from the installed CLI where possible, and
//! the per-message model/effort options passed to it.

use super::agent_manager::AiCliProvider;
use super::cli_detector::{cli_command, CliDetector};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

/// One selectable model.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    /// Value passed to the CLI's model flag.
    pub id: String,
    pub label: String,
    /// Reasoning effort levels this model accepts; empty = no effort control.
    pub efforts: Vec<EffortLevel>,
    pub default_effort: Option<String>,
    pub context_window: Option<u64>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EffortLevel {
    pub id: String,
    pub description: Option<String>,
}

/// Models of one CLI plus what it uses when nothing is chosen.
#[derive(Debug, Clone, Serialize, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ModelCatalog {
    pub models: Vec<ModelInfo>,
    /// The CLI's own configured default model, if it could be read.
    pub default_model: Option<String>,
    pub default_effort: Option<String>,
}

/// Model choice for one message. `None` keeps the CLI's own default.
#[derive(Debug, Clone, Default, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ModelOptions {
    pub model: Option<String>,
    pub effort: Option<String>,
}

impl ModelOptions {
    /// Drop values that could be read as flags or break a `key=value` config.
    pub fn sanitized(self) -> Self {
        let model = self.model.filter(|m| {
            !m.is_empty()
                && !m.starts_with('-')
                && m.chars()
                    .all(|c| c.is_ascii_alphanumeric() || "-_./:[]".contains(c))
        });
        let effort = self
            .effort
            .filter(|e| !e.is_empty() && e.chars().all(|c| c.is_ascii_lowercase()));
        Self { model, effort }
    }
}

/// Add the model/effort flags for `provider` to `args`. A trailing `-` (Codex
/// reads stdin) stays last.
pub fn apply_model_options(
    provider: AiCliProvider,
    args: &mut Vec<String>,
    options: &ModelOptions,
) {
    let mut extra: Vec<String> = Vec::new();
    match provider {
        AiCliProvider::Claude => {
            if let Some(m) = &options.model {
                extra.extend(["--model".into(), m.clone()]);
            }
            if let Some(e) = &options.effort {
                extra.extend(["--effort".into(), e.clone()]);
            }
        }
        AiCliProvider::Codex => {
            if let Some(m) = &options.model {
                extra.extend(["-m".into(), m.clone()]);
            }
            if let Some(e) = &options.effort {
                extra.extend(["-c".into(), format!("model_reasoning_effort=\"{e}\"")]);
            }
        }
        // ponytail: OpenCode/Droid get the model only; add their effort
        // flags once confirmed against their docs.
        AiCliProvider::OpenCode | AiCliProvider::Droid => {
            if let Some(m) = &options.model {
                extra.extend(["-m".into(), m.clone()]);
            }
        }
    }
    let at = if args.last().is_some_and(|a| a == "-") {
        args.len() - 1
    } else {
        args.len()
    };
    args.splice(at..at, extra);
}

/// Aliases Claude Code always accepts; each points at the newest model of
/// its family, so new versions need no update here.
const CLAUDE_ALIASES: [&str; 4] = ["opus", "sonnet", "haiku", "fable"];
const CLAUDE_EFFORTS: [&str; 5] = ["low", "medium", "high", "xhigh", "max"];

/// Model aliases and effort levels named in `claude --help`: the quoted
/// examples under `--model` and the list after `--effort`.
fn parse_claude_help(help: &str) -> (Vec<String>, Vec<String>) {
    let option_block = |flag: &str| -> String {
        let mut lines = help
            .lines()
            .skip_while(|l| !l.trim_start().starts_with(flag));
        let first = lines.next().unwrap_or_default().to_string();
        let rest: Vec<&str> = lines
            .take_while(|l| !l.trim_start().starts_with('-'))
            .collect();
        format!("{first} {}", rest.join(" "))
    };
    let aliases = option_block("--model ")
        .split('\'')
        .skip(1)
        .step_by(2)
        .filter(|w| !w.is_empty() && w.chars().all(|c| c.is_ascii_lowercase()))
        .map(String::from)
        .collect();
    let efforts = option_block("--effort ")
        .split_once('(')
        .and_then(|(_, r)| r.split_once(')'))
        .map(|(list, _)| {
            list.split(',')
                .map(|e| e.trim().to_string())
                .filter(|e| !e.is_empty() && e.chars().all(|c| c.is_ascii_lowercase()))
                .collect()
        })
        .unwrap_or_default();
    (aliases, efforts)
}

fn title_case(id: &str) -> String {
    let mut chars = id.chars();
    chars
        .next()
        .map(|c| c.to_uppercase().chain(chars).collect())
        .unwrap_or_default()
}

/// Claude has no model list command: combine the aliases its help names with
/// the known ones, plus a custom default model from the user's settings.
fn claude_catalog(help: &str, default_model: Option<String>) -> ModelCatalog {
    let (help_aliases, help_efforts) = parse_claude_help(help);
    let effort_ids: Vec<String> = if help_efforts.is_empty() {
        CLAUDE_EFFORTS.iter().map(|e| e.to_string()).collect()
    } else {
        help_efforts
    };
    let efforts: Vec<EffortLevel> = effort_ids
        .into_iter()
        .map(|id| EffortLevel {
            id,
            description: None,
        })
        .collect();

    let mut ids: Vec<String> = Vec::new();
    for id in help_aliases
        .into_iter()
        .chain(CLAUDE_ALIASES.iter().map(|a| a.to_string()))
        .chain(default_model.clone())
    {
        if !ids.contains(&id) {
            ids.push(id);
        }
    }
    let models = ids
        .into_iter()
        .map(|id| ModelInfo {
            label: if id.chars().all(|c| c.is_ascii_lowercase()) {
                title_case(&id)
            } else {
                id.clone()
            },
            efforts: efforts.clone(),
            default_effort: None,
            context_window: None,
            id,
        })
        .collect();
    ModelCatalog {
        models,
        default_model,
        default_effort: None,
    }
}

/// Parse `codex debug models` output, keeping only models Codex lists itself.
fn parse_codex_models(json: &str) -> Vec<ModelInfo> {
    let Ok(value) = serde_json::from_str::<Value>(json) else {
        return Vec::new();
    };
    let list = value.get("models").unwrap_or(&value);
    list.as_array()
        .into_iter()
        .flatten()
        .filter(|m| {
            m.get("visibility")
                .and_then(Value::as_str)
                .unwrap_or("list")
                == "list"
        })
        .filter_map(|m| {
            let id = m.get("slug")?.as_str()?.to_string();
            let efforts = m
                .get("supported_reasoning_levels")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
                .filter_map(|l| {
                    Some(EffortLevel {
                        id: l.get("effort")?.as_str()?.to_string(),
                        description: l
                            .get("description")
                            .and_then(Value::as_str)
                            .map(String::from),
                    })
                })
                .collect();
            Some(ModelInfo {
                label: m
                    .get("display_name")
                    .and_then(Value::as_str)
                    .unwrap_or(&id)
                    .to_string(),
                efforts,
                default_effort: m
                    .get("default_reasoning_level")
                    .and_then(Value::as_str)
                    .map(String::from),
                context_window: m.get("context_window").and_then(Value::as_u64),
                id,
            })
        })
        .collect()
}

/// Top-level `model` and `model_reasoning_effort` from `~/.codex/config.toml`.
fn parse_codex_config(toml: &str) -> (Option<String>, Option<String>) {
    let Ok(doc) = toml.parse::<toml_edit::DocumentMut>() else {
        return (None, None);
    };
    let get = |k: &str| doc.get(k).and_then(|v| v.as_str()).map(String::from);
    (get("model"), get("model_reasoning_effort"))
}

/// `opencode models` prints one `provider/model` per line.
fn parse_opencode_models(out: &str) -> Vec<ModelInfo> {
    out.lines()
        .map(str::trim)
        .filter(|l| l.contains('/') && !l.contains(' '))
        .map(|l| ModelInfo {
            id: l.into(),
            label: l.into(),
            efforts: Vec::new(),
            default_effort: None,
            context_window: None,
        })
        .collect()
}

async fn run_cli(path: &str, args: &[&str]) -> Option<String> {
    let output = tokio::time::timeout(
        Duration::from_secs(15),
        cli_command(path).args(args).kill_on_drop(true).output(),
    )
    .await
    .ok()?
    .ok()?;
    output
        .status
        .success()
        .then(|| String::from_utf8_lossy(&output.stdout).into_owned())
}

fn read_home_file(rel: &str) -> Option<String> {
    std::fs::read_to_string(dirs::home_dir()?.join(rel)).ok()
}

/// Model catalog for `provider`. Missing CLIs or unreadable output give an
/// empty catalog, so the UI falls back to "CLI default" only.
pub async fn list_models(provider: AiCliProvider) -> ModelCatalog {
    match provider {
        AiCliProvider::Claude => {
            let default_model = std::env::var("ANTHROPIC_MODEL").ok().or_else(|| {
                let json: Value =
                    serde_json::from_str(&read_home_file(".claude/settings.json")?).ok()?;
                json.get("model")?.as_str().map(String::from)
            });
            let help = match CliDetector::check_claude_cli_available().await.cli_path {
                Some(path) => run_cli(&path, &["--help"]).await.unwrap_or_default(),
                None => String::new(),
            };
            claude_catalog(&help, default_model)
        }
        AiCliProvider::Codex => {
            let Some(path) = CliDetector::check_codex_cli_available().await.cli_path else {
                return ModelCatalog::default();
            };
            let models = run_cli(&path, &["debug", "models"])
                .await
                .map(|out| parse_codex_models(&out))
                .unwrap_or_default();
            let (default_model, default_effort) = read_home_file(".codex/config.toml")
                .map(|t| parse_codex_config(&t))
                .unwrap_or_default();
            ModelCatalog {
                models,
                default_model,
                default_effort,
            }
        }
        AiCliProvider::OpenCode => {
            let Some(path) = CliDetector::check_opencode_cli_available().await.cli_path else {
                return ModelCatalog::default();
            };
            let models = run_cli(&path, &["models"])
                .await
                .map(|out| parse_opencode_models(&out))
                .unwrap_or_default();
            ModelCatalog {
                models,
                ..Default::default()
            }
        }
        AiCliProvider::Droid => ModelCatalog::default(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn claude_models_and_efforts_come_from_help() {
        let help = "  --effort <level>       Effort level for the current session\n                         (low, medium, high, xhigh, max, turbo)\n  --model <model>        Model for the current session. Use an\n                         alias for the latest model (e.g.\n                         'nova', 'opus', or 'sonnet') or a\n                         model's full name.\n  -n, --name <name>      Set a 'display' name\n";
        let catalog = claude_catalog(help, Some("claude-x-1[1m]".into()));
        let ids: Vec<_> = catalog.models.iter().map(|m| m.id.as_str()).collect();
        // help aliases first, then the known ones, then the custom default
        assert_eq!(
            ids,
            ["nova", "opus", "sonnet", "haiku", "fable", "claude-x-1[1m]"]
        );
        assert_eq!(catalog.models[0].label, "Nova");
        assert_eq!(catalog.models[5].label, "claude-x-1[1m]");
        let efforts: Vec<_> = catalog.models[0]
            .efforts
            .iter()
            .map(|e| e.id.as_str())
            .collect();
        assert_eq!(efforts, ["low", "medium", "high", "xhigh", "max", "turbo"]);

        // No help (CLI missing): known aliases and efforts still work
        let fallback = claude_catalog("", None);
        assert_eq!(fallback.models.len(), 4);
        assert_eq!(fallback.models[0].efforts.len(), 5);
    }

    #[test]
    fn codex_catalog_keeps_listed_models_with_their_efforts() {
        let json = r#"{"models":[
            {"slug":"gpt-a","display_name":"GPT A","default_reasoning_level":"medium",
             "supported_reasoning_levels":[{"effort":"low","description":"Fast"},{"effort":"high"}],
             "visibility":"list","context_window":272000},
            {"slug":"hidden","visibility":"hide"}]}"#;
        let models = parse_codex_models(json);
        assert_eq!(models.len(), 1);
        assert_eq!(models[0].id, "gpt-a");
        assert_eq!(models[0].label, "GPT A");
        assert_eq!(models[0].default_effort.as_deref(), Some("medium"));
        assert_eq!(models[0].context_window, Some(272_000));
        let efforts: Vec<_> = models[0].efforts.iter().map(|e| e.id.as_str()).collect();
        assert_eq!(efforts, ["low", "high"]);
        assert!(parse_codex_models("not json").is_empty());
    }

    #[test]
    fn codex_config_defaults_ignore_profiles() {
        let toml = "model = \"gpt-a\"\nmodel_reasoning_effort = \"xhigh\"\n[profiles.x]\nmodel = \"other\"\n";
        assert_eq!(
            parse_codex_config(toml),
            (Some("gpt-a".into()), Some("xhigh".into()))
        );
    }

    #[test]
    fn opencode_models_are_provider_slash_model_lines() {
        let models =
            parse_opencode_models("opencode/big-pickle\nanthropic/claude-x\n\nsome warning text\n");
        let ids: Vec<_> = models.iter().map(|m| m.id.as_str()).collect();
        assert_eq!(ids, ["opencode/big-pickle", "anthropic/claude-x"]);
    }

    #[test]
    fn options_are_inserted_before_the_stdin_marker() {
        let opts = ModelOptions {
            model: Some("gpt-a".into()),
            effort: Some("high".into()),
        };
        let mut args = vec!["exec".to_string(), "--json".into(), "-".into()];
        apply_model_options(AiCliProvider::Codex, &mut args, &opts);
        assert_eq!(
            args,
            [
                "exec",
                "--json",
                "-m",
                "gpt-a",
                "-c",
                "model_reasoning_effort=\"high\"",
                "-"
            ]
        );

        let mut args = vec!["-p".to_string()];
        apply_model_options(AiCliProvider::Claude, &mut args, &opts);
        assert_eq!(args, ["-p", "--model", "gpt-a", "--effort", "high"]);

        let mut args = vec!["-p".to_string()];
        apply_model_options(AiCliProvider::Claude, &mut args, &ModelOptions::default());
        assert_eq!(args, ["-p"]);
    }

    #[test]
    fn unsafe_option_values_are_dropped() {
        let opts = ModelOptions {
            model: Some("--dangerously-skip-permissions".into()),
            effort: Some("high\" --x".into()),
        }
        .sanitized();
        assert_eq!(opts, ModelOptions::default());
        let ok = ModelOptions {
            model: Some("anthropic/claude-sonnet-4[1m]".into()),
            effort: Some("xhigh".into()),
        }
        .sanitized();
        assert_eq!(ok.model.as_deref(), Some("anthropic/claude-sonnet-4[1m]"));
        assert_eq!(ok.effort.as_deref(), Some("xhigh"));
    }
}
