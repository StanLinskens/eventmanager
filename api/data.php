<?php
// MySQL-backed Event Manager API
// Connects to MySQL using configured credentials and stores data in tables prefixed with `event_`

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// MySQL connection settings - update as needed
$DB_HOST = 'localhost';
$DB_PORT = 3306;
$DB_NAME = 'stan';
$DB_USER = 'stan';
$DB_PASS = 'sl05SQL!22';

try {
    $dsn = "mysql:host={$DB_HOST};port={$DB_PORT};dbname={$DB_NAME};charset=utf8mb4";
    $pdo = new PDO($dsn, $DB_USER, $DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

    // Ensure required tables exist (safe to run on each request)
    $pdo->exec("CREATE TABLE IF NOT EXISTS event_events (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    $pdo->exec("CREATE TABLE IF NOT EXISTS event_participants_map (
        email VARCHAR(255) PRIMARY KEY,
        event_ids JSON NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    $pdo->exec("CREATE TABLE IF NOT EXISTS event_admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(191) UNIQUE,
        password_hash VARCHAR(255)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // Global config table for admin-shared settings
    $pdo->exec("CREATE TABLE IF NOT EXISTS event_config (
        `key` VARCHAR(191) PRIMARY KEY,
        `value` JSON NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    // If no admin exists yet, create a default admin (username: admin, password: admin)
    $stmt = $pdo->query("SELECT COUNT(*) AS cnt FROM event_admins");
    $cntRow = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($cntRow && intval($cntRow['cnt']) === 0) {
        $defaultHash = password_hash('admin', PASSWORD_DEFAULT);
        $ins = $pdo->prepare("INSERT INTO event_admins (username, password_hash) VALUES (:username, :password_hash)");
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
        $stmt = $pdo->query("SELECT * FROM event_events ORDER BY id ASC");
        $events = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            // decode JSON fields
            $row['rounds'] = isset($row['rounds']) && $row['rounds'] !== null ? json_decode($row['rounds'], true) : [];
            $row['participants'] = isset($row['participants']) && $row['participants'] !== null ? json_decode($row['participants'], true) : [];
            // expose a 'date' field (client expects event.date)
            $row['date'] = isset($row['startTime']) && $row['startTime'] ? substr($row['startTime'], 0, 10) : null;
            $events[] = $row;
        }

        // participants map
        $stmt = $pdo->query("SELECT * FROM event_participants_map");
        $participants = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $participants[$row['email']] = isset($row['event_ids']) && $row['event_ids'] !== null ? json_decode($row['event_ids'], true) : [];
        }

        // admins (return usernames only)
        $stmt = $pdo->query("SELECT username FROM event_admins");
        $admins = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) $admins[] = ['username' => $row['username']];

        // next eventIdCounter
        $stmt = $pdo->query("SELECT MAX(id) AS maxid FROM event_events");
        $max = $stmt->fetch(PDO::FETCH_ASSOC);
        $nextId = ($max && $max['maxid']) ? ($max['maxid'] + 1) : 1;

        // read global config
        $cfg = [];
        try {
            $stmtCfg = $pdo->query("SELECT `key`,`value` FROM event_config");
            while ($r = $stmtCfg->fetch(PDO::FETCH_ASSOC)) {
                $cfg[$r['key']] = json_decode($r['value'], true);
            }
        } catch (Exception $e) { /* ignore if table missing */ }

        echo json_encode([
            'events' => $events,
            'participants' => $participants,
            'eventIdCounter' => $nextId,
            'admins' => $admins,
            'config' => $cfg
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
            $stmt = $pdo->prepare("SELECT username, password_hash FROM event_admins WHERE username = :username");
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

    // helper: normalize various ISO datetime formats into MySQL DATETIME (Y-m-d H:i:s)
    $normalize_datetime = function($s) {
        if (!$s) return null;
        try {
            $dt = new DateTime($s);
            return $dt->format('Y-m-d H:i:s');
        } catch (Exception $e) {
            // strip fractional seconds (eg. .440) and retry
            $s2 = preg_replace('/\.(\d+)(?=Z|[+-]|$)/', '', $s);
            try {
                $dt = new DateTime($s2);
                return $dt->format('Y-m-d H:i:s');
            } catch (Exception $e2) {
                return null;
            }
        }
    };

    try {
        $pdo->beginTransaction();

        // Replace events (delete and bulk-insert)
        $pdo->exec("DELETE FROM event_events");
        $insertEvent = $pdo->prepare("INSERT INTO event_events (id, name, description, workshopLeader, startTime, endTime, maxParticipants, location, rounds, participants, createdAt) VALUES (:id, :name, :description, :workshopLeader, :startTime, :endTime, :maxParticipants, :location, :rounds, :participants, :createdAt)");
        foreach ($data['events'] as $ev) {
                // normalize createdAt to MySQL DATETIME format to avoid invalid datetime errors
                $createdAtValue = isset($ev['createdAt']) ? $normalize_datetime($ev['createdAt']) : null;
                if ($createdAtValue === null) $createdAtValue = date('Y-m-d H:i:s');

                $insertEvent->execute([
                ':id' => isset($ev['id']) ? intval($ev['id']) : null,
                ':name' => $ev['name'] ?? '',
                ':description' => $ev['description'] ?? '',
                ':workshopLeader' => $ev['workshopLeader'] ?? '',
                // store the client-provided date into startTime for compatibility (YYYY-MM-DD)
                ':startTime' => isset($ev['date']) ? $ev['date'] : ($ev['startTime'] ?? null),
                ':endTime' => $ev['endTime'] ?? null,
                ':maxParticipants' => isset($ev['maxParticipants']) ? intval($ev['maxParticipants']) : 0,
                ':location' => $ev['location'] ?? '',
                ':rounds' => isset($ev['rounds']) ? json_encode($ev['rounds']) : json_encode([]),
                ':participants' => isset($ev['participants']) ? json_encode($ev['participants']) : json_encode([]),
                ':createdAt' => $createdAtValue
            ]);
        }

        // Replace participants_map
        $pdo->exec("DELETE FROM event_participants_map");
        $insertMap = $pdo->prepare("INSERT INTO event_participants_map (email, event_ids) VALUES (:email, :event_ids)");
        foreach ($data['participants'] as $email => $arr) {
            $insertMap->execute([
                ':email' => $email,
                ':event_ids' => json_encode($arr)
            ]);
        }

        // Optionally replace admins if provided (expecting array of {username, password_hash})
        if (isset($data['admins']) && is_array($data['admins'])) {
            $pdo->exec("DELETE FROM event_admins");
            $insertAdmin = $pdo->prepare("INSERT INTO event_admins (username, password_hash) VALUES (:username, :password_hash)");
            foreach ($data['admins'] as $a) {
                $insertAdmin->execute([
                    ':username' => $a['username'] ?? '',
                    ':password_hash' => $a['password_hash'] ?? ''
                ]);
            }
        }

        // Optionally replace config if provided
        if (isset($data['config']) && is_array($data['config'])) {
            $pdo->exec("DELETE FROM event_config");
            $insertCfg = $pdo->prepare("INSERT INTO event_config (`key`,`value`) VALUES (:k, :v)");
            foreach ($data['config'] as $k => $v) {
                $insertCfg->execute([':k' => $k, ':v' => json_encode($v)]);
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

?>
