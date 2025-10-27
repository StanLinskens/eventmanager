<?php
// Simple "email" logger. Replace with mail() or proper SMTP logic later.

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if ($data === null) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON']);
    exit;
}

$logFile = __DIR__ . '/emails.log';
$entry = [
    'ts' => date('c'),
    'payload' => $data
];
file_put_contents($logFile, json_encode($entry, JSON_PRETTY_PRINT) . PHP_EOL, FILE_APPEND | LOCK_EX);

// Optionally: implement mail sending here. For now we just return success.
echo json_encode(['success' => true]);
