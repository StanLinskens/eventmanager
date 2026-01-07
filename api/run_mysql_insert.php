<?php
// Run event_insert.sql after replacing __ADMIN_PASSWORD_HASH__ with a PHP-generated password_hash
$insertFile = __DIR__ . '/event_insert.sql';
if (!file_exists($insertFile)) { echo "event_insert.sql missing\n"; exit(1); }
$DB_HOST = 'localhost'; $DB_PORT = 3306; $DB_NAME = 'stan'; $DB_USER = 'stan'; $DB_PASS = 'sl05SQL!22';
try {
    $sql = file_get_contents($insertFile);
    if ($sql === false) { throw new Exception('Failed to read SQL file'); }
    // generate hash for default admin password 'admin' (you can change)
    $hash = password_hash('admin', PASSWORD_DEFAULT);
    $sql = str_replace('__ADMIN_PASSWORD_HASH__', $pdoQuote = addslashes($hash), $sql);

    $dsn = "mysql:host={$DB_HOST};port={$DB_PORT};dbname={$DB_NAME};charset=utf8mb4";
    $pdo = new PDO($dsn, $DB_USER, $DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $pdo->beginTransaction();
    // execute the SQL (split by semicolon to run multiple statements)
    $stmts = array_filter(array_map('trim', explode(';', $sql)));
    foreach ($stmts as $s) {
        if ($s === '') continue;
        $pdo->exec($s);
    }
    $pdo->commit();
    echo "Inserts applied OK\n";
} catch (Exception $e) { echo "ERROR: " . $e->getMessage() . "\n"; exit(1); }
