<?php
$db = __DIR__ . '/data.sqlite';
$sqlFile = __DIR__ . '/insert.sql';

if (!file_exists($sqlFile)) {
    echo "insert.sql not found: $sqlFile\n";
    exit(1);
}

// Backup existing DB if present
if (file_exists($db)) {
    $bak = $db . '.bak.' . date('YmdHis');
    if (!copy($db, $bak)) {
        echo "Failed to create backup $bak\n";
        exit(1);
    }
    echo "Backup created: $bak\n";
}

$sql = file_get_contents($sqlFile);
if ($sql === false) {
    echo "Failed to read insert.sql\n";
    exit(1);
}

try {
    $pdo = new PDO('sqlite:' . $db);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Ensure admins table exists (so INSERT won't fail on missing table)
    $pdo->exec("CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT)");

    // Run the SQL from insert.sql
    $pdo->exec($sql);
    echo "OK\n";
    exit(0);
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}
