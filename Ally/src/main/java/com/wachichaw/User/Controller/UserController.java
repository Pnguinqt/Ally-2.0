package com.wachichaw.User.Controller;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import com.wachichaw.User.Entity.LoginRequest;

import com.google.cloud.storage.Bucket;
import com.google.cloud.storage.Blob;
import com.google.firebase.cloud.StorageClient;
import com.wachichaw.Audit.Service.AuditLogService;
import com.wachichaw.Admin.Entity.AdminEntity;
import com.wachichaw.Admin.Service.AdminService;
import com.wachichaw.Client.Entity.ClientEntity;
import com.wachichaw.Config.JwtUtil;
import com.wachichaw.Lawyer.Entity.LawyerEntity;
import com.wachichaw.Lawyer.Service.LawyerService;
import com.wachichaw.User.Entity.AccountType;
import com.wachichaw.User.Entity.LoginRequest;
import com.wachichaw.User.Entity.UserEntity;
import com.wachichaw.User.Repo.UserRepo;
import com.wachichaw.User.Service.UserService;
import com.wachichaw.Lawyer.Repo.LawyerRepo;

import io.swagger.v3.oas.annotations.Operation;
import org.springframework.http.MediaType;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.net.URLEncoder;
import java.net.URI;

import com.google.firebase.FirebaseApp;

@RestController
@RequestMapping("/users")
public class UserController {

    @Autowired
    private UserService userService;
    @Autowired
    private AdminService adminService;
    @Autowired
    private UserRepo userRepo;
    @Autowired
    private JwtUtil jwtUtil;
    @Autowired
    private AuditLogService auditLogService;

    @Autowired
    private LawyerRepo lawyerRepo;

    @Value("${storage.type:local}")
    private String storageType;

    @Value("${local.storage.path:../local-storage}")
    private String localStoragePath;

    private boolean useFirebaseStorage() {
        return "firebase".equalsIgnoreCase(storageType);
    }

    private Bucket firebaseBucket() {
        if (FirebaseApp.getApps().isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Firebase Storage is not configured on the backend");
        }
        return StorageClient.getInstance().bucket();
    }

    private String uploadToFirebase(String folder, MultipartFile file) throws java.io.IOException {
        if (file == null || file.isEmpty()) {
            return null;
        }

        if (!useFirebaseStorage()) {
            System.out.println("Skipping Firebase upload for " + folder + " because storage.type=" + storageType);
            return null;
        }

        String fileName = UUID.randomUUID() + "_" + file.getOriginalFilename();
        Bucket bucket = firebaseBucket();
        Blob blob = bucket.create(folder + "/" + fileName, file.getBytes(), file.getContentType());
        String encodedFileName = URLEncoder.encode(blob.getName(), StandardCharsets.UTF_8);

        return String.format(
                "https://firebasestorage.googleapis.com/v0/b/%s/o/%s?alt=media",
                bucket.getName(),
                encodedFileName);
    }

    private String storeUpload(String folder, MultipartFile file) throws java.io.IOException {
        if (file == null || file.isEmpty()) {
            return null;
        }

        if (useFirebaseStorage()) {
            return uploadToFirebase(folder, file);
        }

        Path uploadDir = Paths.get(localStoragePath, folder).normalize();
        Files.createDirectories(uploadDir);

        String originalName = Optional.ofNullable(file.getOriginalFilename()).orElse("upload");
        String safeOriginalName = Paths.get(originalName).getFileName().toString();
        String fileName = UUID.randomUUID() + "_" + safeOriginalName;
        Path target = uploadDir.resolve(fileName).normalize();
        Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);

        return target.toString();
    }

    private Path resolveStoredUploadPath(String storedPath, String folder) {
        Path stored = Paths.get(storedPath).normalize();
        if (Files.exists(stored)) {
            return stored;
        }

        Path cwd = Paths.get(System.getProperty("user.dir"));
        Path fromCurrentDirectory = cwd.resolve(storedPath).normalize();
        if (Files.exists(fromCurrentDirectory)) {
            return fromCurrentDirectory;
        }

        Path fileName = stored.getFileName();
        if (fileName == null) {
            return stored;
        }

        Path fromConfiguredStorage = Paths.get(localStoragePath, folder, fileName.toString()).normalize();
        if (Files.exists(fromConfiguredStorage)) {
            return fromConfiguredStorage;
        }

        Path fromCurrentConfiguredStorage = cwd.resolve(fromConfiguredStorage).normalize();
        if (Files.exists(fromCurrentConfiguredStorage)) {
            return fromCurrentConfiguredStorage;
        }

        Path projectRoot = "Ally".equalsIgnoreCase(cwd.getFileName() != null ? cwd.getFileName().toString() : "")
                ? cwd.getParent()
                : cwd;
        if (projectRoot != null) {
            Path fromProjectStorage = projectRoot.resolve("local-storage").resolve(folder).resolve(fileName.toString())
                    .normalize();
            if (Files.exists(fromProjectStorage)) {
                return fromProjectStorage;
            }
        }

        return fromConfiguredStorage;
    }

    @PutMapping("/adminUpdate/{id}")
    public ResponseEntity<AdminEntity> updateAdmin(
            @PathVariable int id,
            @RequestBody AdminEntity admin) {
        AdminEntity updated = userService.updateAdmin(
                id,
                admin.getEmail(),
                admin.getPassword(),
                admin.getFname(),
                admin.getLname(),
                admin.getPhoneNumber(),
                admin.getAddress(),
                admin.getCity(),
                admin.getProvince(),
                admin.getZip());
        return ResponseEntity.ok(updated);
    }

    @PutMapping("/clientUpdate/{id}")
    public ResponseEntity<ClientEntity> updateClient(
            @PathVariable int id,
            @RequestBody ClientEntity client) {
        ClientEntity updated = userService.updateClient(
                id,
                client.getEmail(),
                client.getPassword(),
                client.getFname(),
                client.getLname(),
                client.getPhoneNumber(),
                client.getAddress(),
                client.getCity(),
                client.getProvince(),
                client.getZip(),
                client.getProfilePhotoUrl());
        return ResponseEntity.ok(updated);
    }

    @PutMapping("/lawyerUpdate/credentials/{id}")
    public ResponseEntity<LawyerEntity> updateLawyerCredentials(
            @PathVariable int id,
            @RequestParam("credentials") MultipartFile credentialsFile) throws java.io.IOException {
        String credentialsFileURL = storeUpload("credentials", credentialsFile);
        LawyerEntity updated = userService.updateLawyerCredentials(id, credentialsFileURL);
        return ResponseEntity.ok(updated);
    }

    @GetMapping("/{id}/checkcredentials")
    public ResponseEntity<Map<String, Object>> checkUserCredentials(@PathVariable int id) {
        Optional<LawyerEntity> lawyerOpt = lawyerRepo.findById(id);
        if (lawyerOpt.isPresent()) {
            LawyerEntity lawyer = lawyerOpt.get();
            Map<String, Object> response = new HashMap<>();
            response.put("credentialsVerified", lawyer.getCredentialsVerified());
            response.put("credentials", lawyer.getCredentials());
            return ResponseEntity.ok(response);
        } else {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Lawyer not found"));
        }
    }

    @GetMapping("/lawyerCredentials/{id}")
    public ResponseEntity<?> viewLawyerCredentials(@PathVariable int id) {
        LawyerEntity lawyer = lawyerRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lawyer not found"));

        String credentials = lawyer.getCredentials();
        if (credentials == null || credentials.trim().isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("No credentials uploaded");
        }

        if (credentials.startsWith("http://") || credentials.startsWith("https://")) {
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(credentials))
                    .build();
        }

        try {
            Path filePath = resolveStoredUploadPath(credentials, "credentials");
            Resource resource = new UrlResource(filePath.toUri());

            if (!resource.exists() || !resource.isReadable()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Credential file not found");
            }

            String contentType = Files.probeContentType(filePath);
            if (contentType == null) {
                contentType = MediaType.APPLICATION_OCTET_STREAM_VALUE;
            }

            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + resource.getFilename() + "\"")
                    .body(resource);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to open credential file: " + e.getMessage());
        }
    }

    @PutMapping("/lawyerUpdate/{id}")
    public ResponseEntity<LawyerEntity> updateLawyer(
            @PathVariable int id,
            @RequestBody LawyerEntity lawyer) {
        LawyerEntity updated = userService.updateLawyer(
                id,
                lawyer.getEmail(),
                lawyer.getPassword(),
                lawyer.getFname(),
                lawyer.getLname(),
                lawyer.getPhoneNumber(),
                lawyer.getAddress(),
                lawyer.getCity(),
                lawyer.getProvince(),
                lawyer.getZip(),
                lawyer.getBarNumber(),
                lawyer.getSpecialization(),
                lawyer.getExperience(),
                lawyer.getCredentials(),
                lawyer.getEducationInstitution());
        return ResponseEntity.ok(updated);
    }

    @PostMapping(value = "/Client", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> createClient(
            @RequestParam("email") String email,
            @RequestParam("password") String password,
            @RequestParam("Fname") String fname,
            @RequestParam("Lname") String lname,
            @RequestParam("phoneNumber") Long phoneNumber,
            @RequestParam("address") String address,
            @RequestParam("city") String city,
            @RequestParam("province") String province,
            @RequestParam("zip") String zip,
            @RequestParam(value = "profilePhoto", required = false) MultipartFile profilePhotoFile)
            throws java.io.IOException {
        try {
            String profilePhotoUrl = storeUpload("profile_pictures", profilePhotoFile);
            ClientEntity client = userService.createClient(email, password, fname, lname,
                    phoneNumber, address, city, province, zip, profilePhotoUrl);
            // Pending registrations contain a password; never serialize the entity here.
            return ResponseEntity.ok(Map.of("email", client.getEmail(), "verified", client.isVerified()));
        } catch (com.wachichaw.EmailConfig.Service.EmailDeliveryException exception) {
            return ResponseEntity.status(503).body(Map.of("message",
                "We couldn't send your verification email. Please try registering again shortly."));
        } catch (ResponseStatusException exception) {
            return ResponseEntity.status(exception.getStatusCode()).body(Map.of("message",
                exception.getStatusCode().value() == 409 ? "Email already exists." : "Registration could not be completed."));
        } catch (org.springframework.dao.DataIntegrityViolationException exception) {
            return ResponseEntity.status(409).body(Map.of("message", "Registration conflicts with an existing account or invalid account details."));
        } catch (org.springframework.dao.DataAccessException exception) {
            org.slf4j.LoggerFactory.getLogger(UserController.class).error("Registration database operation failed ({})", exception.getClass().getSimpleName());
            return ResponseEntity.status(503).body(Map.of("message", "Registration is temporarily unavailable. Please try again shortly."));
        } catch (Exception exception) {
            org.slf4j.LoggerFactory.getLogger(UserController.class).error("Registration failed ({})", exception.getClass().getSimpleName());
            return ResponseEntity.status(500).body(Map.of("message", "Registration could not be completed. Please try again."));
        }
    }

    @PostMapping("/Admin")
    public AdminEntity createAdmin(@RequestBody AdminEntity admin) {
        return userService.createAdmin(admin.getEmail(), admin.getPassword(), admin.getFname(), admin.getLname(),
                admin.getPhoneNumber(), admin.getAddress(), admin.getCity(),
                admin.getProvince(), admin.getZip());
    }

    @PostMapping(value = "/Lawyer", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<LawyerEntity> createLawyer(
            @RequestParam("email") String email,
            @RequestParam("password") String password,
            @RequestParam("Fname") String fname,
            @RequestParam("Lname") String lname,
            @RequestParam("phoneNumber") Long phoneNumber,
            @RequestParam("address") String address,
            @RequestParam("city") String city,
            @RequestParam("province") String province,
            @RequestParam("zip") String zip,
            @RequestParam("barNumber") String barNumber,
            @RequestParam("specialization") List<String> specialization,
            @RequestParam("experience") String experience,
            @RequestParam("credentials") MultipartFile credentialsFile,
            @RequestParam(value = "educationInstitution", required = false) String educationInstitution,
            @RequestParam(value = "profilePhoto", required = false) MultipartFile profilePhotoFile)
            throws java.io.IOException {
        String profilePhotoUrl = storeUpload("profile_pictures", profilePhotoFile);
        String credentialsFileURL = storeUpload("credentials", credentialsFile);

        LawyerEntity lawyer = userService.createLawyer(
                email,
                password,
                fname,
                lname,
                phoneNumber,
                address,
                city,
                province,
                zip,
                barNumber,
                specialization,
                experience,
                credentialsFileURL,
                educationInstitution,
                profilePhotoUrl);

        return ResponseEntity.ok(lawyer);
    }

    @PostMapping("/login")
    @Operation(summary = "Login a user")
    public ResponseEntity<?> login(@RequestBody LoginRequest loginRequest) {
        try {
            String token = userService.authenticate(loginRequest.getEmail(), loginRequest.getPassword());

            int id = Integer.parseInt(jwtUtil.extractUserId(token));
            String email = jwtUtil.extractEmail(token);
            String accountType = jwtUtil.extractAccountType(token);
            String profilePhoto = jwtUtil.extractProfilePhoto(token);
            Map<String, Object> response = new HashMap<>();
            response.put("token", token);
            response.put("id", id);
            response.put("email", email);
            response.put("accountType", accountType);
            response.put("profilePhoto", profilePhoto);
            try {
                auditLogService.log(id, "LOGIN", "AUTH", "USER", String.valueOf(id), "User logged in", "SUCCESS");
            } catch (Exception auditError) {
                auditError.printStackTrace();
            }
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/getAll")
    @Operation(summary = "Get all users", description = "Retrieves a list of all users.")
    public List<UserEntity> getAllUser() {
        return userService.getAllUser();
    }

    @GetMapping("/getUser/{userId}")
    @Operation(summary = "Get a user by ID", description = "Retrieves a specific user by their ID.")
    public ResponseEntity<?> getUserById(@PathVariable int userId) {
        try {
            Optional<UserEntity> user = userService.getUserById(userId);
            if (user.isPresent()) {
                return ResponseEntity.ok(user.get());
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Failed to retrieve user");
        }
    }

    @PutMapping("/updateStatus/{userId}")
    @Operation(summary = "Update user status", description = "Activates or deactivates a user account.")
    public ResponseEntity<?> updateUserStatus(
            @PathVariable int userId,
            @RequestBody Map<String, String> request) {
        String status = request.get("status");
        if (status == null || status.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Status is required"));
        }

        try {
            UserEntity updatedUser = userService.updateUserStatus(userId, status);
            return ResponseEntity.ok(updatedUser);
        } catch (UsernameNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/bulkUpdateStatus")
    @Operation(summary = "Bulk update user status", description = "Activates or deactivates multiple user accounts.")
    public ResponseEntity<?> bulkUpdateStatus(@RequestBody Map<String, Object> request) {
        Object userIdsValue = request.get("userIds");
        Object statusValue = request.get("status");

        if (!(userIdsValue instanceof List<?>) || statusValue == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "userIds and status are required"));
        }

        List<Integer> userIds = ((List<?>) userIdsValue).stream()
                .map(value -> {
                    if (value instanceof Number number) {
                        return number.intValue();
                    }
                    return Integer.parseInt(String.valueOf(value));
                })
                .collect(Collectors.toList());

        try {
            List<UserEntity> updatedUsers = userService.bulkUpdateUserStatus(userIds, String.valueOf(statusValue));
            return ResponseEntity.ok(Map.of(
                    "message", "User statuses updated",
                    "updatedCount", updatedUsers.size()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/deleteUser{userId}")
    @Operation(summary = "Delete a user", description = "Deletes a user by their ID.")
    public String DeleteUser(@PathVariable int userId) {
        return userService.deleteUser(userId);
    }

    @DeleteMapping("/deleteUser/{userId}")
    @Operation(summary = "Delete a user", description = "Deletes a user by their ID.")
    public String deleteUserWithSlash(@PathVariable int userId) {
        return userService.deleteUser(userId);
    }

    @Autowired
    private LawyerService lawyerService;

    @GetMapping("/search")
    @Operation(summary = "Search and filter lawyers", description = "Filter lawyers by specialization, location, and other criteria")
    public ResponseEntity<List<LawyerEntity>> searchLawyers(
            @RequestParam(required = false) String specialization,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String province,
            @RequestParam(required = false) String experience,
            @RequestParam(required = false) String name) {

        // Get all lawyers from the database
        List<LawyerEntity> allLawyers = userRepo.findAll().stream()
                .filter(user -> user.getAccountType() == AccountType.LAWYER)
                .map(user -> (LawyerEntity) user)
                .collect(Collectors.toList());

        // Apply filters
        List<LawyerEntity> filteredLawyers = allLawyers.stream()
                .filter(lawyer -> {
                    boolean matches = true;

                    // Filter by specialization
                    if (specialization != null && !specialization.trim().isEmpty()
                            && !specialization.equalsIgnoreCase("All Specialties")) {
                        matches = matches && lawyer.getSpecialization() != null
                                && lawyer.getSpecialization().stream()
                                        .anyMatch(spec -> spec.toLowerCase().contains(specialization.toLowerCase()));
                    }

                    // Filter by city
                    if (city != null && !city.trim().isEmpty()
                            && !city.equalsIgnoreCase("All Locations")) {
                        matches = matches && lawyer.getCity() != null
                                && lawyer.getCity().toLowerCase().contains(city.toLowerCase());
                    }

                    // Filter by province
                    if (province != null && !province.trim().isEmpty()
                            && !province.equalsIgnoreCase("All Locations")) {
                        matches = matches && lawyer.getProvince() != null
                                && lawyer.getProvince().toLowerCase().contains(province.toLowerCase());
                    }

                    // Filter by experience
                    if (experience != null && !experience.trim().isEmpty()) {
                        matches = matches && lawyer.getExperience() != null
                                && lawyer.getExperience().toLowerCase().contains(experience.toLowerCase());
                    }

                    // Filter by name (first name or last name)
                    if (name != null && !name.trim().isEmpty()) {
                        matches = matches && ((lawyer.getFname() != null
                                && lawyer.getFname().toLowerCase().contains(name.toLowerCase()))
                                || (lawyer.getLname() != null
                                        && lawyer.getLname().toLowerCase().contains(name.toLowerCase())));
                    }

                    return matches;
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(filteredLawyers);
    }

    @GetMapping("/specializations")
    @Operation(summary = "Get all unique specializations", description = "Returns all unique specializations available")
    public ResponseEntity<List<String>> getAllSpecializations() {
        List<String> specializations = userRepo.findAll().stream()
                .filter(user -> user.getAccountType() == AccountType.LAWYER)
                .map(user -> (LawyerEntity) user)
                .flatMap(lawyer -> lawyer.getSpecialization() != null ? lawyer.getSpecialization().stream()
                        : java.util.stream.Stream.empty())
                .distinct()
                .sorted()
                .collect(Collectors.toList());

        return ResponseEntity.ok(specializations);
    }

    @GetMapping("/locations")
    @Operation(summary = "Get all unique locations", description = "Returns all unique cities and provinces")
    public ResponseEntity<List<String>> getAllLocations() {
        List<String> locations = userRepo.findAll().stream()
                .filter(user -> user.getAccountType() == AccountType.LAWYER)
                .map(user -> (LawyerEntity) user)
                .map(lawyer -> {
                    String location = "";
                    if (lawyer.getCity() != null && !lawyer.getCity().trim().isEmpty()) {
                        location += lawyer.getCity();
                    }
                    if (lawyer.getProvince() != null && !lawyer.getProvince().trim().isEmpty()) {
                        if (!location.isEmpty())
                            location += ", ";
                        location += lawyer.getProvince();
                    }
                    return location;
                })
                .filter(location -> !location.trim().isEmpty())
                .distinct()
                .sorted()
                .collect(Collectors.toList());

        return ResponseEntity.ok(locations);
    }

    @GetMapping("/all")
    @Operation(summary = "Get all lawyers", description = "Returns all lawyers in the system")
    public ResponseEntity<List<LawyerEntity>> getAllLawyers() {
        List<LawyerEntity> lawyers = userRepo.findAll().stream()
                .filter(user -> user.getAccountType() == AccountType.LAWYER)
                .map(user -> (LawyerEntity) user)
                .filter(lawyer -> lawyer.getCredentialsVerified() == true)
                .collect(Collectors.toList());

        return ResponseEntity.ok(lawyers);
    }

    @GetMapping("/statistics")
    public ResponseEntity<?> getUserStatistics() {
        Map<String, Object> statistics = new HashMap<>();

        // Get total users count
        long totalUsers = userRepo.count();

        // Get verified/unverified users instead of active/inactive
        List<UserEntity> allUsers = userRepo.findAll();
        long activeUsers = allUsers.stream().filter(UserEntity::isVerified).count();
        long inactiveUsers = totalUsers - activeUsers;

        // Get verified lawyers count
        long verifiedLawyers = lawyerRepo.countByCredentialsVerifiedTrue();

        // Get pending verifications
        long pendingVerifications = lawyerRepo.countByCredentialsVerifiedFalse();

        // Calculate percentage changes (you might want to store previous values in a
        // database)
        Map<String, String> percentageChanges = new HashMap<>();
        percentageChanges.put("totalUsers", "+0%"); // Replace with actual calculation
        percentageChanges.put("activeUsers", "+0%");
        percentageChanges.put("inactiveUsers", "+0%");
        percentageChanges.put("verifiedLawyers", "+0%");

        statistics.put("totalUsers", totalUsers);
        statistics.put("activeUsers", activeUsers);
        statistics.put("inactiveUsers", inactiveUsers);
        statistics.put("verifiedLawyers", verifiedLawyers);
        statistics.put("pendingVerifications", pendingVerifications);
        statistics.put("percentageChanges", percentageChanges);

        return ResponseEntity.ok(statistics);
    }

    @PostMapping("/change-password")
    @Operation(summary = "Change user password", description = "Allows authenticated users to change their password")
    public ResponseEntity<Map<String, Object>> changePassword(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody Map<String, Object> request) {

        Map<String, Object> response = new HashMap<>();

        try {
            // Extract token from Authorization header
            String token = authHeader.replace("Bearer ", "");

            // Extract user ID from token
            int userId = Integer.parseInt(jwtUtil.extractUserId(token));

            // Get request parameters
            String currentPassword = (String) request.get("currentPassword");
            String newPassword = (String) request.get("newPassword");

            // Validate input
            if (currentPassword == null || currentPassword.trim().isEmpty()) {
                response.put("success", false);
                response.put("message", "Current password is required");
                return ResponseEntity.badRequest().body(response);
            }

            if (newPassword == null || newPassword.trim().isEmpty()) {
                response.put("success", false);
                response.put("message", "New password is required");
                return ResponseEntity.badRequest().body(response);
            }

            if (newPassword.length() < 8) {
                response.put("success", false);
                response.put("message", "New password must be at least 8 characters long");
                return ResponseEntity.badRequest().body(response);
            }

            // Call service method
            boolean success = userService.changePassword(userId, currentPassword, newPassword);

            if (success) {
                response.put("success", true);
                response.put("message", "Password changed successfully");
                return ResponseEntity.ok(response);
            } else {
                response.put("success", false);
                response.put("message", "Current password is incorrect");
                return ResponseEntity.badRequest().body(response);
            }

        } catch (Exception e) {
            response.put("success", false);
            response.put("message", "Failed to change password: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    @PostMapping("/forgot-password")
    @Operation(summary = "Request a password reset link")
    public ResponseEntity<Map<String, Object>> forgotPassword(@RequestBody Map<String, String> request) {
        Map<String, Object> response = new HashMap<>();
        try {
            userService.requestPasswordReset(request.get("email"));
        } catch (Exception exception) {
            // Do not reveal whether an address is registered or whether mail delivery failed.
            System.err.println("Password reset email could not be sent: " + exception.getMessage());
        }
        response.put("success", true);
        response.put("message", "If an account exists for this email, a reset link has been sent.");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/reset-password")
    @Operation(summary = "Reset a password using a one-time email link")
    public ResponseEntity<Map<String, Object>> resetPassword(@RequestBody Map<String, String> request) {
        Map<String, Object> response = new HashMap<>();
        try {
            userService.resetPassword(request.get("token"), request.get("newPassword"));
            response.put("success", true);
            response.put("message", "Your password has been reset. You can now log in.");
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException exception) {
            response.put("success", false);
            response.put("message", exception.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

}
