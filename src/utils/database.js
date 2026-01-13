const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../../captions.db'));

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    upload_path TEXT NOT NULL,
    audio_path TEXT,
    status TEXT DEFAULT 'uploaded',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    chunk_path TEXT NOT NULL,
    transcript TEXT,
    start_time REAL,
    end_time REAL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (video_id) REFERENCES videos(id),
    UNIQUE(video_id, chunk_index)
  );

  CREATE TABLE IF NOT EXISTS captions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    start_time REAL NOT NULL,
    end_time REAL NOT NULL,
    text TEXT NOT NULL,
    FOREIGN KEY (video_id) REFERENCES videos(id)
  );

  CREATE INDEX IF NOT EXISTS idx_chunks_video ON chunks(video_id);
  CREATE INDEX IF NOT EXISTS idx_captions_video ON captions(video_id);
`);

// Video operations
const createVideo = db.prepare(`
  INSERT INTO videos (id, filename, upload_path)
  VALUES (?, ?, ?)
`);

const getVideo = db.prepare('SELECT * FROM videos WHERE id = ?');

const updateVideoStatus = db.prepare(`
  UPDATE videos SET status = ?, completed_at = DATETIME('now')
  WHERE id = ?
`);

const updateVideoAudioPath = db.prepare(`
  UPDATE videos SET audio_path = ? WHERE id = ?
`);

// Chunk operations
const createChunk = db.prepare(`
  INSERT INTO chunks (video_id, chunk_index, chunk_path)
  VALUES (?, ?, ?)
`);

const getChunks = db.prepare(`
  SELECT * FROM chunks WHERE video_id = ? ORDER BY chunk_index ASC
`);

const getPendingChunk = db.prepare(`
  SELECT * FROM chunks WHERE video_id = ? AND status = 'pending'
  ORDER BY chunk_index ASC LIMIT 1
`);

const updateChunkStatus = db.prepare(`
  UPDATE chunks SET status = ?, completed_at = DATETIME('now')
  WHERE id = ?
`);

const updateChunkTranscript = db.prepare(`
  UPDATE chunks SET transcript = ? WHERE id = ?
`);

// Caption operations
const insertCaption = db.prepare(`
  INSERT INTO captions (video_id, chunk_index, start_time, end_time, text)
  VALUES (?, ?, ?, ?, ?)
`);

const getCaptions = db.prepare(`
  SELECT * FROM captions WHERE video_id = ?
  ORDER BY chunk_index ASC, start_time ASC
`);

const deleteVideoCaptions = db.prepare('DELETE FROM captions WHERE video_id = ?');

module.exports = {
  db,
  createVideo,
  getVideo,
  updateVideoStatus,
  updateVideoAudioPath,
  createChunk,
  getChunks,
  getPendingChunk,
  updateChunkStatus,
  updateChunkTranscript,
  insertCaption,
  getCaptions,
  deleteVideoCaptions
};
