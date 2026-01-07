<?php
// Simple runner to apply the provided MySQL schema file to the configured DB.
$schemaFile = __DIR__ . '/schema_event.sql';
if (!file_exists($schemaFile)) { echo "schema_event.sql missing\n"; exit(1); }
$DB_HOST = 'localhost'; $DB_PORT = 3306; $DB_NAME = 'stan'; $DB_USER = 'stan'; $DB_PASS = 'sl05SQL!22';
try {
    $dsn = "mysql:host={$DB_HOST};port={$DB_PORT};dbname={$DB_NAME};charset=utf8mb4";
    $pdo = new PDO($dsn, $DB_USER, $DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $sql = file_get_contents($schemaFile);
    $pdo->exec($sql);
    echo "Schema applied OK\n";
} catch (Exception $e) { echo "ERROR: " . $e->getMessage() . "\n"; exit(1); }
