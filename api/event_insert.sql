-- Sample inserts for Event Manager (MySQL)
-- Replace admin password via the runner script which will insert a generated hash

-- Admin (password placeholder will be replaced by run_mysql_insert.php)
INSERT INTO event_admins (username, password_hash) VALUES ('admin', '__ADMIN_PASSWORD_HASH__');

-- Example event
INSERT INTO event_events (name, description, workshopLeader, startTime, endTime, maxParticipants, location, rounds, participants)
VALUES (
  'Example Workshop',
  'An example event to demonstrate insertion',
  'Jane Doe',
  '2026-01-15 10:00:00',
  '2026-01-15 12:00:00',
  30,
  'Main Hall',
  JSON_ARRAY(JSON_OBJECT('round',1,'length',30)),
  JSON_ARRAY()
);

-- Example participant mapping
INSERT INTO event_participants_map (email, event_ids) VALUES ('alice@example.com', JSON_ARRAY(1));
