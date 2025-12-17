<?php
// Simple SQLite-backed "DB" for the Event Manager.
// Stores events (with participants embedded as JSON), a participants mapping, and admin users.
// Later you can replace these with a full RDBMS schema if desired.

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dbFile = __DIR__ . '/data.sqlite';

try {
    $pdo = new PDO('sqlite:' . $dbFile);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Create tables if needed
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY,
            name TEXT,
            description TEXT,
            workshopLeader TEXT,
            startTime TEXT,
            endTime TEXT,
            maxParticipants INTEGER,
            location TEXT,
            rounds TEXT,
            participants TEXT,
            createdAt TEXT
        );
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS participants_map (
            email TEXT PRIMARY KEY,
            event_ids TEXT
        );
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY,
            username TEXT UNIQUE,
            password_hash TEXT
        );
    ");
    // If no admin exists yet, create a default admin (username: admin, password: admin)
    $stmt = $pdo->query("SELECT COUNT(*) AS cnt FROM admins");
    $cntRow = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($cntRow && intval($cntRow['cnt']) === 0) {
        $defaultHash = password_hash('admin', PASSWORD_DEFAULT);
        $ins = $pdo->prepare("INSERT INTO admins (username, password_hash) VALUES (:username, :password_hash)");
        $ins->execute([':username' => 'admin', ':password_hash' => $defaultHash]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'DB init error: ' . $e->getMessage()]);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    try {
        // Read events
        $stmt = $pdo->query("SELECT * FROM events ORDER BY id ASC");
        $events = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            // decode JSON fields
            $row['rounds'] = $row['rounds'] !== null ? json_decode($row['rounds'], true) : [];
            $row['participants'] = $row['participants'] !== null ? json_decode($row['participants'], true) : [];
            $events[] = $row;
        }

        // participants map
        $stmt = $pdo->query("SELECT * FROM participants_map");
        $participants = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $participants[$row['email']] = $row['event_ids'] !== null ? json_decode($row['event_ids'], true) : [];
        }

        // admins (return usernames only)
        $stmt = $pdo->query("SELECT username FROM admins");
        $admins = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) $admins[] = ['username' => $row['username']];

        // next eventIdCounter
        $stmt = $pdo->query("SELECT MAX(id) AS maxid FROM events");
        $max = $stmt->fetch(PDO::FETCH_ASSOC);
        $nextId = ($max && $max['maxid']) ? ($max['maxid'] + 1) : 1;

        echo json_encode([
            'events' => $events,
            'participants' => $participants,
            'eventIdCounter' => $nextId,
            'admins' => $admins
        ], JSON_UNESCAPED_SLASHES);
        exit;
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Read error: ' . $e->getMessage()]);
        exit;
    }
}

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if ($data === null) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid JSON']);
        exit;
    }

    // Support small actions such as login
    if (isset($data['action']) && $data['action'] === 'login') {
        $username = isset($data['username']) ? $data['username'] : '';
        $password = isset($data['password']) ? $data['password'] : '';
        if (!$username || !$password) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing username or password']);
            exit;
        }
        try {
            $stmt = $pdo->prepare("SELECT username, password_hash FROM admins WHERE username = :username");
            $stmt->execute([':username' => $username]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $found = $row && isset($row['password_hash']) && password_verify($password, $row['password_hash']);
            if ($found) {
                echo json_encode(['success' => true, 'username' => $username]);
            } else {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Invalid credentials']);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Login error: ' . $e->getMessage()]);
        }
        exit;
    }

    // Basic required keys: events and participants (participants map)
    if (!isset($data['events']) || !isset($data['participants'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Missing events or participants']);
        exit;
    }

    try {
        $pdo->beginTransaction();

        // Replace events
        $pdo->exec("DELETE FROM events");
        $insertEvent = $pdo->prepare("INSERT INTO events (id, name, description, workshopLeader, startTime, endTime, maxParticipants, location, rounds, participants, createdAt) VALUES (:id, :name, :description, :workshopLeader, :startTime, :endTime, :maxParticipants, :location, :rounds, :participants, :createdAt)");
        foreach ($data['events'] as $ev) {
            $insertEvent->execute([
                ':id' => isset($ev['id']) ? intval($ev['id']) : null,
                ':name' => $ev['name'] ?? '',
                ':description' => $ev['description'] ?? '',
                ':workshopLeader' => $ev['workshopLeader'] ?? '',
                ':startTime' => $ev['startTime'] ?? '',
                ':endTime' => $ev['endTime'] ?? '',
                ':maxParticipants' => isset($ev['maxParticipants']) ? intval($ev['maxParticipants']) : 0,
                ':location' => $ev['location'] ?? '',
                ':rounds' => isset($ev['rounds']) ? json_encode($ev['rounds']) : json_encode([]),
                ':participants' => isset($ev['participants']) ? json_encode($ev['participants']) : json_encode([]),
                ':createdAt' => isset($ev['createdAt']) ? $ev['createdAt'] : (isset($ev['createdAt']) ? $ev['createdAt'] : date('c'))
            ]);
        }

        // Replace participants_map
        $pdo->exec("DELETE FROM participants_map");
        $insertMap = $pdo->prepare("INSERT INTO participants_map (email, event_ids) VALUES (:email, :event_ids)");
        foreach ($data['participants'] as $email => $arr) {
            $insertMap->execute([
                ':email' => $email,
                ':event_ids' => json_encode($arr)
            ]);
        }

        // Optionally replace admins if provided (expecting array of {username, password_hash})
        if (isset($data['admins']) && is_array($data['admins'])) {
            $pdo->exec("DELETE FROM admins");
            $insertAdmin = $pdo->prepare("INSERT INTO admins (username, password_hash) VALUES (:username, :password_hash)");
            foreach ($data['admins'] as $a) {
                $insertAdmin->execute([
                    ':username' => $a['username'] ?? '',
                    ':password_hash' => $a['password_hash'] ?? ''
                ]);
            }
        }

        $pdo->commit();
        echo json_encode(['success' => true]);
        exit;
    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Save error: ' . $e->getMessage()]);
        exit;
    }
}

// Method not allowed
http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed']);
