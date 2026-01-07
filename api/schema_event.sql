-- Schema for Event Manager (MySQL)
-- Tables are prefixed with `event_`

CREATE TABLE IF NOT EXISTS event_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name TEXT,
  description TEXT,
  workshopLeader VARCHAR(255),
  startTime DATETIME NULL,
  endTime DATETIME NULL,
  maxParticipants INT DEFAULT 0,
  location VARCHAR(255),
  rounds JSON NULL,
  participants JSON NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_participants_map (
  email VARCHAR(255) PRIMARY KEY,
  event_ids JSON NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(191) UNIQUE,
  password_hash VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
