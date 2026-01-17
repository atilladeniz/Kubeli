use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Session metadata stored in database
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionRecord {
    pub session_id: String,
    pub cluster_context: String,
    pub created_at: DateTime<Utc>,
    pub last_active_at: DateTime<Utc>,
    pub permission_mode: String,
    pub title: Option<String>,
}

/// Message stored in database
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageRecord {
    pub message_id: String,
    pub session_id: String,
    pub role: String, // "user", "assistant", "system"
    pub content: String,
    pub tool_calls: Option<String>, // JSON blob
    pub timestamp: DateTime<Utc>,
}

/// Summary of a session for listing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionSummary {
    pub session_id: String,
    pub cluster_context: String,
    pub created_at: DateTime<Utc>,
    pub last_active_at: DateTime<Utc>,
    pub title: Option<String>,
    pub message_count: i32,
}

/// Session store using SQLite
pub struct SessionStore {
    conn: Arc<Mutex<Connection>>,
}

impl SessionStore {
    /// Create a new session store with database at the given path
    pub fn new(db_path: PathBuf) -> SqliteResult<Self> {
        // Ensure parent directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).ok();
        }

        let conn = Connection::open(&db_path)?;

        // Enable foreign keys
        conn.execute("PRAGMA foreign_keys = ON", [])?;

        // Run migrations
        Self::migrate(&conn)?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    /// Run database migrations
    fn migrate(conn: &Connection) -> SqliteResult<()> {
        // Create sessions table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                cluster_context TEXT NOT NULL,
                created_at TEXT NOT NULL,
                last_active_at TEXT NOT NULL,
                permission_mode TEXT NOT NULL DEFAULT 'default',
                title TEXT
            )",
            [],
        )?;

        // Create messages table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS messages (
                message_id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                tool_calls TEXT,
                timestamp TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
            )",
            [],
        )?;

        // Create index for faster session queries
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_sessions_cluster
             ON sessions(cluster_context)",
            [],
        )?;

        // Create index for faster message queries
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_messages_session
             ON messages(session_id, timestamp)",
            [],
        )?;

        Ok(())
    }

    /// Save a new session
    pub async fn save_session(&self, session: &SessionRecord) -> SqliteResult<()> {
        let conn = self.conn.lock().await;
        conn.execute(
            "INSERT OR REPLACE INTO sessions
             (session_id, cluster_context, created_at, last_active_at, permission_mode, title)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                session.session_id,
                session.cluster_context,
                session.created_at.to_rfc3339(),
                session.last_active_at.to_rfc3339(),
                session.permission_mode,
                session.title,
            ],
        )?;
        Ok(())
    }

    /// Update session's last active timestamp
    #[allow(dead_code)]
    pub async fn update_session_activity(&self, session_id: &str) -> SqliteResult<()> {
        let conn = self.conn.lock().await;
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE sessions SET last_active_at = ?1 WHERE session_id = ?2",
            params![now, session_id],
        )?;
        Ok(())
    }

    /// Update session title
    pub async fn update_session_title(&self, session_id: &str, title: &str) -> SqliteResult<()> {
        let conn = self.conn.lock().await;
        conn.execute(
            "UPDATE sessions SET title = ?1 WHERE session_id = ?2",
            params![title, session_id],
        )?;
        Ok(())
    }

    /// Load a session by ID
    #[allow(dead_code)]
    pub async fn load_session(&self, session_id: &str) -> SqliteResult<Option<SessionRecord>> {
        let conn = self.conn.lock().await;
        let mut stmt = conn.prepare(
            "SELECT session_id, cluster_context, created_at, last_active_at, permission_mode, title
             FROM sessions WHERE session_id = ?1",
        )?;

        let result = stmt.query_row(params![session_id], |row| {
            Ok(SessionRecord {
                session_id: row.get(0)?,
                cluster_context: row.get(1)?,
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(2)?)
                    .unwrap_or_default()
                    .with_timezone(&Utc),
                last_active_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(3)?)
                    .unwrap_or_default()
                    .with_timezone(&Utc),
                permission_mode: row.get(4)?,
                title: row.get(5)?,
            })
        });

        match result {
            Ok(session) => Ok(Some(session)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    /// List all sessions for a cluster
    pub async fn list_sessions_for_cluster(
        &self,
        cluster_context: &str,
    ) -> SqliteResult<Vec<SessionSummary>> {
        let conn = self.conn.lock().await;
        let mut stmt = conn.prepare(
            "SELECT s.session_id, s.cluster_context, s.created_at, s.last_active_at, s.title,
                    COUNT(m.message_id) as message_count
             FROM sessions s
             LEFT JOIN messages m ON s.session_id = m.session_id
             WHERE s.cluster_context = ?1
             GROUP BY s.session_id
             ORDER BY s.last_active_at DESC",
        )?;

        let rows = stmt.query_map(params![cluster_context], |row| {
            Ok(SessionSummary {
                session_id: row.get(0)?,
                cluster_context: row.get(1)?,
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(2)?)
                    .unwrap_or_default()
                    .with_timezone(&Utc),
                last_active_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(3)?)
                    .unwrap_or_default()
                    .with_timezone(&Utc),
                title: row.get(4)?,
                message_count: row.get(5)?,
            })
        })?;

        let mut sessions = Vec::new();
        for row in rows {
            sessions.push(row?);
        }
        Ok(sessions)
    }

    /// Delete a session and all its messages
    pub async fn delete_session(&self, session_id: &str) -> SqliteResult<()> {
        let conn = self.conn.lock().await;
        // Messages will be deleted by CASCADE
        conn.execute(
            "DELETE FROM sessions WHERE session_id = ?1",
            params![session_id],
        )?;
        Ok(())
    }

    /// Delete all sessions for a cluster
    pub async fn delete_sessions_for_cluster(&self, cluster_context: &str) -> SqliteResult<()> {
        let conn = self.conn.lock().await;
        conn.execute(
            "DELETE FROM sessions WHERE cluster_context = ?1",
            params![cluster_context],
        )?;
        Ok(())
    }

    /// Save a message
    pub async fn save_message(&self, message: &MessageRecord) -> SqliteResult<()> {
        let conn = self.conn.lock().await;
        conn.execute(
            "INSERT INTO messages
             (message_id, session_id, role, content, tool_calls, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                message.message_id,
                message.session_id,
                message.role,
                message.content,
                message.tool_calls,
                message.timestamp.to_rfc3339(),
            ],
        )?;

        // Update session activity
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE sessions SET last_active_at = ?1 WHERE session_id = ?2",
            params![now, message.session_id],
        )?;

        Ok(())
    }

    /// Update a message (e.g., when streaming completes)
    pub async fn update_message(
        &self,
        message_id: &str,
        content: &str,
        tool_calls: Option<&str>,
    ) -> SqliteResult<()> {
        let conn = self.conn.lock().await;
        conn.execute(
            "UPDATE messages SET content = ?1, tool_calls = ?2 WHERE message_id = ?3",
            params![content, tool_calls, message_id],
        )?;
        Ok(())
    }

    /// Get all messages for a session
    pub async fn get_messages(&self, session_id: &str) -> SqliteResult<Vec<MessageRecord>> {
        let conn = self.conn.lock().await;
        let mut stmt = conn.prepare(
            "SELECT message_id, session_id, role, content, tool_calls, timestamp
             FROM messages
             WHERE session_id = ?1
             ORDER BY timestamp ASC",
        )?;

        let rows = stmt.query_map(params![session_id], |row| {
            Ok(MessageRecord {
                message_id: row.get(0)?,
                session_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                tool_calls: row.get(4)?,
                timestamp: DateTime::parse_from_rfc3339(&row.get::<_, String>(5)?)
                    .unwrap_or_default()
                    .with_timezone(&Utc),
            })
        })?;

        let mut messages = Vec::new();
        for row in rows {
            messages.push(row?);
        }
        Ok(messages)
    }

    /// Get recent messages for context (last N messages)
    pub async fn get_recent_messages(
        &self,
        session_id: &str,
        limit: usize,
    ) -> SqliteResult<Vec<MessageRecord>> {
        let conn = self.conn.lock().await;
        let mut stmt = conn.prepare(
            "SELECT message_id, session_id, role, content, tool_calls, timestamp
             FROM messages
             WHERE session_id = ?1
             ORDER BY timestamp DESC
             LIMIT ?2",
        )?;

        let rows = stmt.query_map(params![session_id, limit as i64], |row| {
            Ok(MessageRecord {
                message_id: row.get(0)?,
                session_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                tool_calls: row.get(4)?,
                timestamp: DateTime::parse_from_rfc3339(&row.get::<_, String>(5)?)
                    .unwrap_or_default()
                    .with_timezone(&Utc),
            })
        })?;

        let mut messages = Vec::new();
        for row in rows {
            messages.push(row?);
        }
        // Reverse to get chronological order
        messages.reverse();
        Ok(messages)
    }

    /// Build conversation history string for resuming context
    pub async fn build_conversation_context(&self, session_id: &str) -> SqliteResult<String> {
        let messages = self.get_recent_messages(session_id, 20).await?;

        let mut context = String::new();
        context.push_str("Previous conversation:\n\n");

        for msg in messages {
            let role = match msg.role.as_str() {
                "user" => "User",
                "assistant" => "Assistant",
                _ => "System",
            };
            context.push_str(&format!("{}: {}\n\n", role, msg.content));
        }

        Ok(context)
    }

    /// Get database statistics
    #[allow(dead_code)]
    pub async fn get_stats(&self) -> SqliteResult<(i64, i64)> {
        let conn = self.conn.lock().await;
        let session_count: i64 =
            conn.query_row("SELECT COUNT(*) FROM sessions", [], |row| row.get(0))?;
        let message_count: i64 =
            conn.query_row("SELECT COUNT(*) FROM messages", [], |row| row.get(0))?;
        Ok((session_count, message_count))
    }

    /// Clean up old sessions (older than N days)
    pub async fn cleanup_old_sessions(&self, days: i64) -> SqliteResult<usize> {
        let conn = self.conn.lock().await;
        let cutoff = Utc::now() - chrono::Duration::days(days);
        let cutoff_str = cutoff.to_rfc3339();

        let count = conn.execute(
            "DELETE FROM sessions WHERE last_active_at < ?1",
            params![cutoff_str],
        )?;
        Ok(count)
    }
}

/// Thread-safe wrapper
pub type SharedSessionStore = Arc<SessionStore>;

/// Create a new shared session store
pub fn create_session_store(db_path: PathBuf) -> Result<SharedSessionStore, String> {
    SessionStore::new(db_path)
        .map(Arc::new)
        .map_err(|e| format!("Failed to create session store: {}", e))
}
