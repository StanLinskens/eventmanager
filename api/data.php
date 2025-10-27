<?php
// Simple file-backed "DB" for event manager.
// Later you can replace the read/write parts with real DB queries.

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

$dataFile = __DIR__ . '/data.json';

// Ensure a baseline file exists
if (!file_exists($dataFile)) {
    $initial = [
        'events' => [],
        'participants' => new stdClass(), // empty object
        'eventIdCounter' => 1
    ];
    file_put_contents($dataFile, json_encode($initial, JSON_PRETTY_PRINT));
}

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($method === 'GET') {
    // Return the JSON store
    readfile($dataFile);
    exit;
}

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if ($data === null) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid JSON']);
        exit;
    }

    // Basic validation (ensure keys exist)
    if (!isset($data['events']) || !isset($data['participants']) || !isset($data['eventIdCounter'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Missing required fields']);
        exit;
    }

    // Save safely (atomic write)
    $tmp = $dataFile . '.tmp';
    if (file_put_contents($tmp, json_encode($data, JSON_PRETTY_PRINT)) === false) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Could not write file']);
        exit;
    }
    rename($tmp, $dataFile);

    echo json_encode(['success' => true]);
    exit;
}

// Other methods not allowed
http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed']);
