<?php
header('Content-Type: application/json');

try {
    $db_path = __DIR__ . '/../database/rfid_system.db';
    $db = new SQLite3($db_path);

    $data = json_decode(file_get_contents('php://input'), true);
    if (!isset($data['rfid'])) {
        echo json_encode(["success" => false, "message" => "No RFID provided."]);
        exit;
    }

    // Since we don't have a validity column, we'll update created_at to current time
    // This effectively renews the ID for another year
    $newDate = date('Y-m-d H:i:s');
    $stmt = $db->prepare("UPDATE stakeholders SET created_at = :created_at WHERE rfid = :rfid");
    $stmt->bindValue(':created_at', $newDate, SQLITE3_TEXT);
    $stmt->bindValue(':rfid', $data['rfid'], SQLITE3_TEXT);
    
    if ($stmt->execute()) {
        echo json_encode(["success" => true, "message" => "RFID {$data['rfid']} renewed successfully. New expiration: " . date('Y-m-d', strtotime('+1 year'))]);
    } else {
        echo json_encode(["success" => false, "message" => "Failed to renew RFID."]);
    }

} catch (Exception $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
?>