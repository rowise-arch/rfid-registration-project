<?php
// public/export_sqlite.php
header('Content-Type: application/json');

try {
    $db_path = __DIR__ . '/../src/database/rfid_system.db';
    
    if (!file_exists($db_path)) {
        throw new Exception("Database file not found: " . $db_path);
    }
    
    $db = new SQLite3($db_path);
    $db->enableExceptions(true);

    $query = "SELECT * FROM stakeholders";
    $result = $db->query($query);
    
    $stakeholders = [];
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $stakeholders[] = $row;
    }

    // Return as downloadable JSON
    header('Content-Disposition: attachment; filename="sqlite_export_' . date('Y-m-d') . '.json"');
    echo json_encode($stakeholders, JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ], JSON_PRETTY_PRINT);
}
?>