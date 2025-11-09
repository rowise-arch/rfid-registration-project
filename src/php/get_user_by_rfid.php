<?php
header('Content-Type: application/json');
try {
    if (!isset($_GET['rfid'])) {
        echo json_encode(["error" => "Missing RFID"]);
        exit;
    }

    $rfid = trim($_GET['rfid']);
    $db = new SQLite3(__DIR__ . '/../database/rfid_system.db');

    $stmt = $db->prepare("
        SELECT 
            id, rfid, role, photo, first_name, middle_initial, last_name,
            department, course_or_position, address, contact_number, birthdate,
            height, weight, gender, civil_status, emergency_contact, 
            emergency_address, created_at
        FROM stakeholders 
        WHERE rfid = :rfid 
        LIMIT 1
    ");
    
    $stmt->bindValue(':rfid', $rfid, SQLITE3_TEXT);
    $result = $stmt->execute();
    $row = $result->fetchArray(SQLITE3_ASSOC);

    echo json_encode($row ?: []);

} catch (Exception $e) {
    echo json_encode(["error" => $e->getMessage()]);
}
?>