<?php
// Login endpoint for eventmanager
// POST JSON { role: 'teacher'|'student', username, password } for teacher
// POST JSON { role: 'student', code } for student (verified against local config only)

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!$data || !isset($data['role'])) { http_response_code(400); echo json_encode(['ok'=>false,'error'=>'role required']); exit; }
$config = [];
$cfgFile = __DIR__ . '/.auth_config.php';
if (file_exists($cfgFile)) { $config = (array)include $cfgFile; }

$role = strtolower(trim($data['role']));
if ($role === 'student') {
    $provided = isset($data['code']) ? (string)$data['code'] : '';
    $secret = isset($config['student_secret']) ? $config['student_secret'] : null;
    if ($secret && $provided === $secret) {
        echo json_encode(['ok'=>true,'role'=>'student']);
        exit;
    }
    http_response_code(401); echo json_encode(['ok'=>false,'error'=>'invalid student code']); exit;
}

if ($role === 'teacher' || $role === 'admin') {
    $username = isset($data['username']) ? (string)$data['username'] : '';
    $password = isset($data['password']) ? (string)$data['password'] : '';
    if (!$username || !$password) { http_response_code(400); echo json_encode(['ok'=>false,'error'=>'username+password required']); exit; }

    // connect to MySQL using same defaults as data.php, but allow override in config
    $dbCfg = array_merge(['host'=>'localhost','port'=>3306,'name'=>'stan','user'=>'stan','pass'=>'sl05SQL!22'], isset($config['db']) && is_array($config['db']) ? $config['db'] : []);
    try {
        $dsn = "mysql:host={$dbCfg['host']};port={$dbCfg['port']};dbname={$dbCfg['name']};charset=utf8mb4";
        $pdo = new PDO($dsn, $dbCfg['user'], $dbCfg['pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $stmt = $pdo->prepare("SELECT username, password_hash FROM event_admins WHERE username = :username LIMIT 1");
        $stmt->execute([':username' => $username]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row && isset($row['password_hash']) && password_verify($password, $row['password_hash'])) {
            // teacher authenticated
            echo json_encode(['ok'=>true,'role'=>'teacher','username'=>$row['username']]);
            exit;
        }
        http_response_code(401); echo json_encode(['ok'=>false,'error'=>'invalid credentials']); exit;
    } catch (Exception $e) {
        http_response_code(500); echo json_encode(['ok'=>false,'error'=>'db error: '.$e->getMessage()]); exit;
    }
}

http_response_code(400); echo json_encode(['ok'=>false,'error'=>'unknown role']); exit;
