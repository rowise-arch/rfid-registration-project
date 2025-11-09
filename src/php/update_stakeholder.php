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

    $stmt = $db->prepare("
        UPDATE stakeholders SET 
            first_name = :first_name,
            middle_initial = :middle_initial,
            last_name = :last_name,
            role = :role,
            department = :department,
            course_or_position = :course_or_position,
            contact_number = :contact_number
        WHERE rfid = :rfid
    ");

    $stmt->bindValue(':first_name', $data['first_name'], SQLITE3_TEXT);
    $stmt->bindValue(':middle_initial', $data['middle_initial'], SQLITE3_TEXT);
    $stmt->bindValue(':last_name', $data['last_name'], SQLITE3_TEXT);
    $stmt->bindValue(':role', $data['role'], SQLITE3_TEXT);
    $stmt->bindValue(':department', $data['department'], SQLITE3_TEXT);
    $stmt->bindValue(':course_or_position', $data['course_or_position'], SQLITE3_TEXT);
    $stmt->bindValue(':contact_number', $data['contact_number'], SQLITE3_TEXT);
    $stmt->bindValue(':rfid', $data['rfid'], SQLITE3_TEXT);
    
    if ($stmt->execute()) {
        echo json_encode(["success" => true, "message" => "Stakeholder updated successfully."]);
    } else {
        echo json_encode(["success" => false, "message" => "Failed to update stakeholder."]);
    }

} catch (Exception $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
?>