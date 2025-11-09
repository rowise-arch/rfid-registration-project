<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/php_errors.log');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    // Get raw POST data
    $input = file_get_contents('php://input');
    error_log("Received data: " . $input);
    
    if (empty($input)) {
        throw new Exception("No data received");
    }

    $data = json_decode($input, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("Invalid JSON: " . json_last_error_msg());
    }

    if (!isset($data['rfid']) || empty(trim($data['rfid']))) {
        throw new Exception("Missing or invalid RFID.");
    }

    // Database connections
    $servername = "localhost";
    $username = "root";
    $password = "";
    
    error_log("Connecting to databases...");
    
    // Connect to stakeholders database
    $stakeholders_db = new mysqli($servername, $username, $password, "stakeholders");
    if ($stakeholders_db->connect_error) {
        throw new Exception("Stakeholders connection failed: " . $stakeholders_db->connect_error);
    }
    
    // Connect to entrysense database  
    $entrysense_db = new mysqli($servername, $username, $password, "entrysense");
    if ($entrysense_db->connect_error) {
        $stakeholders_db->close();
        throw new Exception("Entrysense connection failed: " . $entrysense_db->connect_error);
    }

    error_log("Both databases connected successfully");

    $rfid = trim($data['rfid']);

    // Check if RFID exists in stakeholders
    $check1 = $stakeholders_db->prepare("SELECT COUNT(*) as count FROM stakeholders WHERE rfid = ?");
    $check1->bind_param("s", $rfid);
    $check1->execute();
    $result1 = $check1->get_result()->fetch_assoc();

    if ($result1['count'] > 0) {
        throw new Exception("RFID already registered in stakeholders database.");
    }

    // Check if RFID exists in entrysense
    $check2 = $entrysense_db->prepare("SELECT COUNT(*) as count FROM rfid_info WHERE rfid_uid = ?");
    $check2->bind_param("s", $rfid);
    $check2->execute();
    $result2 = $check2->get_result()->fetch_assoc();

    if ($result2['count'] > 0) {
        throw new Exception("RFID already registered in entrysense database.");
    }

    // Start transactions
    $stakeholders_db->begin_transaction();
    $entrysense_db->begin_transaction();

    try {
        // 1. INSERT INTO STAKEHOLDERS
        $stmt1 = $stakeholders_db->prepare("
            INSERT INTO stakeholders (
                rfid, role, photo, first_name, middle_initial, last_name, department,
                course_or_position, address, contact_number, birthdate, height, weight,
                gender, civil_status, emergency_contact, emergency_address
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        // FIX: Create variables for each parameter (cannot pass literals by reference)
        $role = $data['role'] ?? '';
        $photo = $data['photo'] ?? '';
        $first_name = $data['first_name'] ?? '';
        $middle_initial = $data['middle_initial'] ?? '';
        $last_name = $data['last_name'] ?? '';
        $department = $data['department'] ?? '';
        $course_or_position = $data['course_or_position'] ?? '';
        $address = $data['address'] ?? '';
        $contact_number = $data['contact_number'] ?? '';
        $birthdate = $data['birthdate'] ?? '';
        $height = $data['height'] ?? '';
        $weight = $data['weight'] ?? '';
        $gender = $data['gender'] ?? '';
        $civil_status = $data['civil_status'] ?? '';
        $emergency_contact = $data['emergency_contact'] ?? '';
        $emergency_address = $data['emergency_address'] ?? '';

        $stmt1->bind_param(
            "sssssssssssssssss",
            $rfid,
            $role,
            $photo,
            $first_name,
            $middle_initial,
            $last_name,
            $department,
            $course_or_position,
            $address,
            $contact_number,
            $birthdate,
            $height,
            $weight,
            $gender,
            $civil_status,
            $emergency_contact,
            $emergency_address
        );

        if (!$stmt1->execute()) {
            throw new Exception("Stakeholders insert failed: " . $stmt1->error);
        }

        // 2. INSERT INTO ENTRYSENSE - RFID_INFO
        $stmt2 = $entrysense_db->prepare("INSERT INTO rfid_info (rfid_uid, role) VALUES (?, ?)");
        $stmt2->bind_param("ss", $rfid, $role);
        
        if (!$stmt2->execute()) {
            throw new Exception("RFID info insert failed: " . $stmt2->error);
        }

        $rfid_id = $entrysense_db->insert_id;

        // 3. ROLE-SPECIFIC INSERTS
        if ($role === 'student') {
            $student_id = 'S-' . str_pad($rfid_id, 4, '0', STR_PAD_LEFT);
            $stmt3 = $entrysense_db->prepare("
                INSERT INTO student (student_id, first_name, middle_name, last_name, department, course, photo) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt3->bind_param(
                "sssssss",
                $student_id,
                $first_name,
                $middle_initial,
                $last_name,
                $department,
                $course_or_position,
                $photo
            );
            
            if (!$stmt3->execute()) {
                throw new Exception("Student insert failed: " . $stmt3->error);
            }

            // Link RFID to student
            $stmt4 = $entrysense_db->prepare("INSERT INTO rfid_student_info (rfid_id, student_id) VALUES (?, ?)");
            $stmt4->bind_param("is", $rfid_id, $student_id);
            $stmt4->execute();

        } elseif ($role === 'employee') {
            $employee_id = 'E-' . str_pad($rfid_id, 4, '0', STR_PAD_LEFT);
            $stmt3 = $entrysense_db->prepare("
                INSERT INTO employee (employee_id, first_name, middle_name, last_name, department, position, photo) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt3->bind_param(
                "sssssss",
                $employee_id,
                $first_name,
                $middle_initial,
                $last_name,
                $department,
                $course_or_position,
                $photo
            );
            
            if (!$stmt3->execute()) {
                throw new Exception("Employee insert failed: " . $stmt3->error);
            }

            $stmt4 = $entrysense_db->prepare("INSERT INTO rfid_employee_info (rfid_id, employee_id) VALUES (?, ?)");
            $stmt4->bind_param("is", $rfid_id, $employee_id);
            $stmt4->execute();

        } elseif ($role === 'guest') {
            $guest_id = 'G-' . str_pad($rfid_id, 4, '0', STR_PAD_LEFT);
            $stmt3 = $entrysense_db->prepare("
                INSERT INTO guest (guest_id, first_name, middle_name, last_name, purpose, photo) 
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            $stmt3->bind_param(
                "ssssss",
                $guest_id,
                $first_name,
                $middle_initial,
                $last_name,
                $course_or_position,
                $photo
            );
            
            if (!$stmt3->execute()) {
                throw new Exception("Guest insert failed: " . $stmt3->error);
            }

            $stmt4 = $entrysense_db->prepare("INSERT INTO rfid_guest_info (rfid_id, guest_id) VALUES (?, ?)");
            $stmt4->bind_param("is", $rfid_id, $guest_id);
            $stmt4->execute();
        }

        // Commit both transactions
        $stakeholders_db->commit();
        $entrysense_db->commit();

        echo json_encode([
            "success" => true, 
            "message" => "Stakeholder registered successfully in both databases."
        ]);

    } catch (Exception $e) {
        // Rollback both transactions on error
        $stakeholders_db->rollback();
        $entrysense_db->rollback();
        throw new Exception("Database operation failed: " . $e->getMessage());
    }

    // Close connections
    $stakeholders_db->close();
    $entrysense_db->close();

} catch (Exception $e) {
    error_log("Registration error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false, 
        "message" => $e->getMessage()
    ]);
}
?>