<?php
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/php_error.log');
header('Content-Type: application/json');

try {
    $db_path = __DIR__ . '/../database/rfid_system.db';
    $db = new SQLite3($db_path);

    $query = "
    SELECT 
        id,
        rfid,
        role,
        photo,
        first_name,
        middle_initial,
        last_name,
        department,
        course_or_position,
        address,
        contact_number,
        birthdate,
        height,
        weight,
        gender,
        civil_status,
        emergency_contact,
        emergency_address,
        created_at
    FROM stakeholders
    ORDER BY id DESC
    ";

    $result = $db->query($query);
    $rows = [];
    
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $rows[] = $row;
    }

    echo json_encode($rows);

} catch (Exception $e) {
    echo json_encode(["error" => $e->getMessage()]);
}
?>