-- Updated schema for Event Manager (v2)
-- Adds a dedicated DATE column and migration steps while keeping legacy startTime/endTime
-- Intended for MySQL 8+. Run with appropriate permissions.

-- Create/modify main events table
CREATE TABLE IF NOT EXISTS event_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name TEXT,
  description TEXT,
  workshopLeader VARCHAR(255),
  `date` DATE NULL,
  startTime DATETIME NULL, -- legacy: may hold full datetime or date (YYYY-MM-DD)
  endTime DATETIME NULL,
  maxParticipants INT DEFAULT 0,
  location VARCHAR(255),
  rounds JSON NULL, -- array of objects: [{"round":1, "time":"HH:MM"}, ...]
  participants JSON NULL, -- array of participant objects
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_event_date (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Migration: add `date` column if missing and populate from startTime when available
ALTER TABLE event_events ADD COLUMN IF NOT EXISTS `date` DATE NULL;
UPDATE event_events SET `date` = DATE(startTime) WHERE `date` IS NULL AND startTime IS NOT NULL;

-- Participants mapping table (unchanged)
CREATE TABLE IF NOT EXISTS event_participants_map (
  email VARCHAR(255) PRIMARY KEY,
  event_ids JSON NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Admins table (unchanged)
CREATE TABLE IF NOT EXISTS event_admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(191) UNIQUE,
  password_hash VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Global config table
CREATE TABLE IF NOT EXISTS event_config (
  `key` VARCHAR(191) PRIMARY KEY,
  `value` JSON NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Notes:
-- - `rounds` is JSON and should contain objects with `round` (number) and optional `time` (HH:MM).
-- - `participants` should be an array of objects containing at least: name, email, studentNumber (string), studentProgram, registeredAt.
-- - This migration keeps backward compatibility by preserving `startTime`/`endTime` while exposing a dedicated `date` field.
-- - After running, consider updating application code to consistently use the `date` column for event dates.
