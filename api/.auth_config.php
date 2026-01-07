<?php
// Lightweight auth config for eventmanager
// Change the STUDENT_SECRET value to a code you give to students (students do NOT authenticate against the DB)
// Keep this file outside webroot or protect it in production.

return [
    'student_secret' => 'student-code-123',
    // short shared secret required to register a teacher account (change before deployment)
    'registration_code' => 'teach-register-123',
    // Optionally override DB credentials used by login.php (falls back to data.php settings)
    'db' => [
        'host' => 'localhost',
        'port' => 3306,
        'name' => 'stan',
        'user' => 'stan',
        'pass' => 'sl05SQL!22'
    ]
];
