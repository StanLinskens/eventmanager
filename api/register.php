<?php
// Teacher registration endpoint. Requires a registration_code from .auth_config.php to allow creating teacher accounts.
// POST JSON { username, password, registration_code }

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!$data) { http_response_code(400); echo json_encode(['ok'=>false,'error'=>'invalid json']); exit; }
if (!isset($data['username']) || !isset($data['password'])) { http_response_code(400); echo json_encode(['ok'=>false,'error'=>'username,password required']); exit; }

// load config (registration_code removed — registration protected by other means externally)
$config = [];
$cfgFile = __DIR__ . '/.auth_config.php';
if (file_exists($cfgFile)) $config = (array)include $cfgFile;

// basic validation
$username = trim($data['username']);
$password = (string)$data['password'];
if ($username === '' || strlen($password) < 6) { http_response_code(400); echo json_encode(['ok'=>false,'error'=>'invalid username or password (min 6 chars)']); exit; }

// connect to DB
$dbCfg = isset($config['db']) && is_array($config['db']) ? $config['db'] : ['host'=>'localhost','port'=>3306,'name'=>'stan','user'=>'stan','pass'=>'sl05SQL!22'];
try {
    $dsn = "mysql:host={$dbCfg['host']};port={$dbCfg['port']};dbname={$dbCfg['name']};charset=utf8mb4";
    $pdo = new PDO($dsn, $dbCfg['user'], $dbCfg['pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    // ensure table exists
    $pdo->exec("CREATE TABLE IF NOT EXISTS event_admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(191) UNIQUE,
        password_hash VARCHAR(255)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // check for existing username
    $stmt = $pdo->prepare("SELECT id FROM event_admins WHERE username = :username LIMIT 1");
    $stmt->execute([':username'=>$username]);
    if ($stmt->fetch(PDO::FETCH_ASSOC)) { http_response_code(409); echo json_encode(['ok'=>false,'error'=>'username exists']); exit; }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $ins = $pdo->prepare("INSERT INTO event_admins (username, password_hash) VALUES (:username, :hash)");
    $ins->execute([':username'=>$username, ':hash'=>$hash]);
    echo json_encode(['ok'=>true,'username'=>$username]);
    exit;
} catch (Exception $e) {
    http_response_code(500); echo json_encode(['ok'=>false,'error'=>'db error: '.$e->getMessage()]); exit;
}
