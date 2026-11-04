package com.wachichaw.User.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import com.google.firebase.FirebaseApp;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import com.wachichaw.Admin.Entity.AdminEntity;
import com.wachichaw.Admin.Service.SystemSettingsService;
import com.wachichaw.Client.Entity.ClientEntity;
import com.wachichaw.Client.Entity.TempClient;
import com.wachichaw.Config.JwtUtil;
import com.wachichaw.EmailConfig.Controller.VerificationController;
import com.wachichaw.EmailConfig.Service.VerificationService;
import com.wachichaw.EmailConfig.Service.EmailService;
import com.wachichaw.Lawyer.Entity.LawyerEntity;
import com.wachichaw.Lawyer.Entity.TempLawyer;
import com.wachichaw.User.Entity.AccountType;
import com.wachichaw.User.Entity.UserEntity;
import com.wachichaw.User.Entity.PasswordResetToken;
import com.wachichaw.User.Repo.PasswordResetTokenRepo;
import com.wachichaw.User.Repo.UserRepo;

@Service
public class UserService {

    @Autowired
    private final UserRepo userRepo;
    @Autowired
    private final PasswordEncoder passwordEncoder;
    @Autowired
    private AuthenticationManager authenticationManager;
    @Autowired
    private JwtUtil jwtUtil;
    @Autowired
    private TempClient tempClientStorageService;
    @Autowired
    private TempLawyer tempLawyerStorageService;
    @Autowired
    private VerificationService verificationService;
    @Autowired
    private SystemSettingsService systemSettingsService;
    @Autowired
    private PasswordResetTokenRepo passwordResetTokenRepo;
    @Autowired
    private EmailService emailService;

    private final FirebaseApp firebaseApp;

    @Value("${BREVO_API_KEY:}")
    private String brevoApiKey;

    @Value("${LOCAL_DEV:${app.local-dev:false}}")
    private boolean localDev;

    @Value("${frontend.url}")
    private String frontendUrl;

    private final SecureRandom secureRandom = new SecureRandom();

    public UserService(UserRepo userRepo, PasswordEncoder passwordEncoder, FirebaseApp firebaseApp) {
        this.userRepo = userRepo;
        this.passwordEncoder = passwordEncoder;
        this.firebaseApp = firebaseApp;
    }

    private boolean shouldSendVerificationEmail() {
        return systemSettingsService.getSettings().isEnableEmailVerification();
    }

    private boolean canSendVerificationEmail() {
        return brevoApiKey != null && !brevoApiKey.trim().isEmpty();
    }

    public AdminEntity createAdmin(String email, String pass, String Fname, String Lname, Long phoneNumber,
            String address, String city, String province, String zip) {
        AdminEntity admin = new AdminEntity();
        admin.setEmail(email);
        admin.setPassword(passwordEncoder.encode(pass));
        admin.setFname(Fname);
        admin.setLname(Lname);
        admin.setPhoneNumber(phoneNumber);
        admin.setAddress(address);
        admin.setCity(city);
        admin.setProvince(province);
        admin.setZip(zip);
        admin.setAccountType(AccountType.ADMIN);
        admin.setDepartment("General");
        return userRepo.save(admin);
    }

    public ClientEntity saveClient(String email, String pass, String Fname, String Lname, Long phoneNumber,
            String address, String city, String province, String zip, String profilePhoto) {
        ClientEntity client = new ClientEntity();
        client.setEmail(email);
        client.setPassword(passwordEncoder.encode(pass));
        client.setFname(Fname);
        client.setLname(Lname);
        client.setPhoneNumber(phoneNumber);
        client.setAddress(address);
        client.setCity(city);
        client.setProvince(province);
        client.setZip(zip);
        client.setProfilePhotoUrl(profilePhoto);
        client.setAccountType(AccountType.CLIENT);
        return userRepo.save(client);
    }

    public ClientEntity createClient(String email, String pass, String Fname, String Lname, Long phoneNumber,
            String address, String city, String province, String zip, String profilePhoto) {
        Optional<UserEntity> optionalUser = userRepo.findByEmail(email);
        if (optionalUser.isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "User with email " + email + " already exists.");
        } else {
            ClientEntity client = new ClientEntity();
            client.setEmail(email);
            client.setPassword(pass);
            client.setFname(Fname);
            client.setLname(Lname);
            client.setPhoneNumber(phoneNumber);
            client.setAddress(address);
            client.setCity(city);
            client.setProvince(province);
            client.setZip(zip);
            client.setProfilePhotoUrl(profilePhoto);
            client.setAccountType(AccountType.CLIENT);
            // Local development must not depend on an external email provider.
            // The example environment contains a placeholder API key, so checking
            // only whether the key is non-empty still attempts a real API call.
            if (localDev || !shouldSendVerificationEmail()) {
                client.setVerified(true);
                client.setPassword(passwordEncoder.encode(pass));
                return userRepo.save(client);
            }
            String token = String.valueOf((int) (Math.random() * 900000) + 100000);
            tempClientStorageService.saveUnverifiedUser(token, client);
            ClientEntity savedClient = client;
            try {
                verificationService.sendVerificationEmail(savedClient.getEmail(), savedClient.getFname(), token);
            } catch (RuntimeException e) {
                tempClientStorageService.removeUnverifiedUser(token);
                if (!localDev) {
                    throw e;
                }
                client.setVerified(true);
                client.setPassword(passwordEncoder.encode(pass));
                return userRepo.save(client);
            }
            return savedClient;
        }
    }

    public void verifyClient(String email) {
        Optional<UserEntity> optionalUser = userRepo.findByEmail(email);
        if (!optionalUser.isPresent() || !(optionalUser.get() instanceof ClientEntity)) {

            throw new RuntimeException("User not found with email: " + email);
        }

        ClientEntity user = (ClientEntity) optionalUser.get();
        user.setVerified(true);
        userRepo.save(user);
    }

    public LawyerEntity saveLawyer(String email, String pass, String Fname, String Lname, Long phoneNumber,
            String address, String city, String province, String zip, String barNumber, List<String> specialization,
            String experience, String credentials, String educationInstitution, String profilePhoto) {
        LawyerEntity lawyer = new LawyerEntity();
        lawyer.setEmail(email);
        lawyer.setPassword(passwordEncoder.encode(pass));
        lawyer.setFname(Fname);
        lawyer.setLname(Lname);
        lawyer.setPhoneNumber(phoneNumber);
        lawyer.setAddress(address);
        lawyer.setCity(city);
        lawyer.setProvince(province);
        lawyer.setZip(zip);
        lawyer.setCasesHandled(0);
        lawyer.setBarNumber(barNumber);
        lawyer.setSpecialization(specialization);
        lawyer.setExperience(experience);
        lawyer.setCredentials(credentials);
        lawyer.setEducationInstitution(educationInstitution);
        lawyer.setProfilePhotoUrl(profilePhoto);
        lawyer.setAccountType(AccountType.LAWYER);
        return userRepo.save(lawyer);
    }

    public LawyerEntity createLawyer(String email, String pass, String Fname, String Lname, Long phoneNumber,
            String address, String city, String province, String zip, String barNumber, List<String> specialization,
            String experience, String credentials, String educationInstitution, String profilePhoto) {
        Optional<UserEntity> optionalUser = userRepo.findByEmail(email);
        if (optionalUser.isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "User with email " + email + " already exists.");
        } else {
            LawyerEntity lawyer = new LawyerEntity();
            lawyer.setEmail(email);
            lawyer.setPassword(pass);
            lawyer.setFname(Fname);
            lawyer.setLname(Lname);
            lawyer.setPhoneNumber(phoneNumber);
            lawyer.setAddress(address);
            lawyer.setCity(city);
            lawyer.setProvince(province);
            lawyer.setZip(zip);
            lawyer.setBarNumber(barNumber);
            lawyer.setSpecialization(specialization);
            lawyer.setExperience(experience);
            lawyer.setCredentials(credentials);
            lawyer.setEducationInstitution(educationInstitution);
            lawyer.setProfilePhotoUrl(profilePhoto);
            lawyer.setAccountType(AccountType.LAWYER);
            if (!shouldSendVerificationEmail() || (localDev && !canSendVerificationEmail())) {
                lawyer.setVerified(true);
                lawyer.setPassword(passwordEncoder.encode(pass));
                return userRepo.save(lawyer);
            }
            String token = String.valueOf((int) (Math.random() * 900000) + 100000);
            tempLawyerStorageService.saveUnverifiedUser(token, lawyer);
            tempLawyerStorageService.getUnverifiedUser(token);
            System.out.println("Lawyer retrieved: " + profilePhoto);
            System.out.println("Lawyer email: " + lawyer.getEmail());
            System.out.println("Lawyer first name: " + Fname);
            System.out.println("Lawyer password: " + token);
            LawyerEntity savedLawyer = lawyer;
            try {
                verificationService.sendVerificationEmail(savedLawyer.getEmail(), savedLawyer.getFname(), token);
            } catch (RuntimeException e) {
                if (!localDev) {
                    throw e;
                }
                lawyer.setVerified(true);
                lawyer.setPassword(passwordEncoder.encode(pass));
                return userRepo.save(lawyer);
            }
            return savedLawyer;
        }
    }

    public void verifyLawyer(String email) {
        Optional<UserEntity> optionalUser = userRepo.findByEmail(email);

        if (!optionalUser.isPresent() || !(optionalUser.get() instanceof LawyerEntity)) {
            throw new RuntimeException("User not found with email: " + email);
        }

        LawyerEntity user = (LawyerEntity) optionalUser.get();
        user.setVerified(true);
        userRepo.save(user);
    }

    public AdminEntity updateAdmin(int id, String email, String pass, String Fname, String Lname, Long phoneNumber,
            String address, String city, String province, String zip) {
        AdminEntity admin = (AdminEntity) userRepo.findById(id)
                .orElseThrow(() -> new UsernameNotFoundException("Admin not found with id: " + id));
        admin.setEmail(email);
        if (pass != null && !pass.trim().isEmpty()) {
            admin.setPassword(passwordEncoder.encode(pass));
        }
        admin.setFname(Fname);
        admin.setLname(Lname);
        admin.setPhoneNumber(phoneNumber);
        admin.setAddress(address);
        admin.setCity(city);
        admin.setProvince(province);
        admin.setZip(zip);
        return userRepo.save(admin);
    }

    public ClientEntity updateClient(int id, String email, String pass, String Fname, String Lname, Long phoneNumber,
            String address, String city, String province, String zip, String profilePhoto) {
        ClientEntity client = (ClientEntity) userRepo.findById(id)
                .orElseThrow(() -> new UsernameNotFoundException("Client not found with id: " + id));
        client.setEmail(email);
        if (pass != null && !pass.trim().isEmpty()) {
            client.setPassword(passwordEncoder.encode(pass));
        }
        client.setFname(Fname);
        client.setLname(Lname);
        client.setPhoneNumber(phoneNumber);
        client.setAddress(address);
        client.setCity(city);
        client.setProvince(province);
        client.setZip(zip);
        client.setProfilePhotoUrl(profilePhoto);
        return userRepo.save(client);
    }

    public LawyerEntity updateLawyerCredentials(int id, String credentials) {
        LawyerEntity lawyer = (LawyerEntity) userRepo.findById(id)
                .orElseThrow(() -> new UsernameNotFoundException("Lawyer not found with id: " + id));
        if (credentials != null && !credentials.trim().isEmpty()) {
            lawyer.setCredentials(credentials);
        } else {
            throw new IllegalArgumentException("Credentials cannot be null or empty");
        }
        return userRepo.save(lawyer);
    }

    public LawyerEntity updateLawyer(int id, String email, String pass, String Fname, String Lname, Long phoneNumber,
            String address, String city, String province, String zip, String barNumber, List<String> specialization,
            String experience, String credentials, String educationInstitution) {
        LawyerEntity lawyer = (LawyerEntity) userRepo.findById(id)
                .orElseThrow(() -> new UsernameNotFoundException("Lawyer not found with id: " + id));
        lawyer.setEmail(email);
        if (pass != null && !pass.trim().isEmpty()) {
            lawyer.setPassword(passwordEncoder.encode(pass));
        }
        lawyer.setFname(Fname);
        lawyer.setLname(Lname);
        lawyer.setPhoneNumber(phoneNumber);
        lawyer.setAddress(address);
        lawyer.setCity(city);
        lawyer.setProvince(province);
        lawyer.setZip(zip);
        lawyer.setBarNumber(barNumber);
        if (specialization != null && !specialization.isEmpty()) {
            lawyer.setSpecialization(specialization);
        }
        lawyer.setExperience(experience);
        if (credentials != null && !credentials.trim().isEmpty()) {
            lawyer.setCredentials(credentials);
        }

        lawyer.setEducationInstitution(educationInstitution);
        return userRepo.save(lawyer);
    }

    public String authenticate(String email, String password) {
        UserEntity foundUser = userRepo.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with email: " + email));
        if (passwordEncoder.matches(password, foundUser.getPassword())) {
            return jwtUtil.generateToken(foundUser);
        } else {
            System.out.println("Invalid credentials: password does not match.");
            throw new RuntimeException("Invalid credentials");
        }
    }

    @Transactional
    public String authenticateWithGoogle(String idToken) {

        try {
            // 1. Verify Firebase ID token
            FirebaseToken decodedToken = FirebaseAuth.getInstance(firebaseApp).verifyIdToken(idToken);

            Map<String, Object> claims = decodedToken.getClaims();

            // 2. Retrieve Firebase user information
            String firebaseUid = decodedToken.getUid();

            String email = (String) claims.get("email");

            Boolean emailVerified = (Boolean) claims.get("email_verified");

            String displayName = (String) claims.get("name");

            String profilePhoto = (String) claims.get("picture");

            // 3. Validate email
            if (email == null || email.isBlank()) {
                throw new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Google account does not have a valid email.");
            }

            if (!Boolean.TRUE.equals(emailVerified)) {
                throw new ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        "Please verify your Google email before continuing.");
            }

            if (displayName == null || displayName.isBlank()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Your Google account must have a display name.");
            }

            email = email.trim().toLowerCase(java.util.Locale.ROOT);

            // 4. Check whether Firebase UID already exists
            Optional<UserEntity> existingUser = userRepo.findByFirebaseUid(firebaseUid);

            if (existingUser.isPresent()) {

                UserEntity user = existingUser.get();

                // Google login is only permitted for CLIENT accounts
                if (user.getAccountType() != AccountType.CLIENT) {
                    throw new ResponseStatusException(
                            HttpStatus.FORBIDDEN,
                            "This account is not eligible for Google login.");
                }

                user.setVerified(true);
                userRepo.save(user);

                return jwtUtil.generateToken(user);
            }

            // 5. Prevent automatic linking to existing accounts
            Optional<UserEntity> emailUser = userRepo.findByEmail(email);

            if (emailUser.isPresent()) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "An account with this email already exists. Please use your existing login method.");
            }

            // 6. Split Google's display name
            String[] nameParts = displayName.trim().split("\\s+", 2);

            String firstName = nameParts[0];

            String lastName = nameParts.length > 1
                    ? nameParts[1]
                    : "";

            // 7. Create a new CLIENT account
            ClientEntity client = new ClientEntity();

            client.setEmail(email);
            client.setFname(firstName);
            client.setLname(lastName);

            // Google-only account: generate an unknown random password
            client.setPassword(passwordEncoder.encode(generateResetToken()));

            client.setFirebaseUid(firebaseUid);
            client.setVerified(true);
            client.setAccountType(AccountType.CLIENT);
            client.setProfilePhotoUrl(profilePhoto);

            ClientEntity savedClient = userRepo.save(client);

            // 8. Generate existing ALLY JWT
            return jwtUtil.generateToken(savedClient);

        } catch (FirebaseAuthException e) {

            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Invalid or expired Firebase ID token.");
        }
    }

    public boolean changePassword(int userId, String currentPassword, String newPassword) {
        try {
            // Find user by ID
            Optional<UserEntity> optionalUser = userRepo.findById(userId);
            if (!optionalUser.isPresent()) {
                throw new UsernameNotFoundException("User not found with id: " + userId);
            }

            UserEntity user = optionalUser.get();

            // Verify current password
            if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
                return false; // Current password is incorrect
            }

            // Check if new password is different from current password
            if (passwordEncoder.matches(newPassword, user.getPassword())) {
                throw new IllegalArgumentException("New password must be different from current password");
            }

            // Update password
            user.setPassword(passwordEncoder.encode(newPassword));
            userRepo.save(user);

            return true;

        } catch (Exception e) {
            System.err.println("Error changing password for user " + userId + ": " + e.getMessage());
            throw new RuntimeException("Failed to change password: " + e.getMessage());
        }
    }

    @Transactional
    public void requestPasswordReset(String email) {
        if (email == null || email.isBlank()) {
            return;
        }

        Optional<UserEntity> user = userRepo.findByEmail(email.trim());
        if (user.isEmpty()) {
            return;
        }

        passwordResetTokenRepo.deleteByUser(user.get());
        String rawToken = generateResetToken();
        PasswordResetToken resetToken = new PasswordResetToken();
        resetToken.setUser(user.get());
        resetToken.setTokenHash(hashToken(rawToken));
        resetToken.setExpiresAt(LocalDateTime.now().plusMinutes(15));
        passwordResetTokenRepo.save(resetToken);

        String resetLink = frontendUrl + "/reset-password?token=" + rawToken;
        emailService.sendPasswordResetEmail(user.get().getEmail(), resetLink);
    }

    @Transactional
    public void resetPassword(String rawToken, String newPassword) {
        if (rawToken == null || rawToken.isBlank() || newPassword == null || newPassword.length() < 8) {
            throw new IllegalArgumentException("The reset link or new password is invalid");
        }

        PasswordResetToken resetToken = passwordResetTokenRepo
                .findByTokenHashAndUsedAtIsNullAndExpiresAtAfter(hashToken(rawToken), LocalDateTime.now())
                .orElseThrow(() -> new IllegalArgumentException("This password reset link is invalid or has expired"));

        UserEntity user = resetToken.getUser();
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepo.save(user);

        resetToken.setUsedAt(LocalDateTime.now());
        passwordResetTokenRepo.save(resetToken);
    }

    private String generateResetToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hashToken(String rawToken) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256")
                    .digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    public List<UserEntity> getAllUser() {
        return userRepo.findAll();
    }

    public Optional<UserEntity> getUserById(int id) {
        return userRepo.findById(id);
    }

    public UserEntity updateUserStatus(int id, String status) {
        UserEntity user = userRepo.findById(id)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with id: " + id));

        String normalizedStatus = status.trim().toLowerCase();
        if ("active".equals(normalizedStatus) || "approved".equals(normalizedStatus)
                || "verified".equals(normalizedStatus)) {
            user.setVerified(true);
        } else if ("inactive".equals(normalizedStatus) || "deactivated".equals(normalizedStatus)
                || "rejected".equals(normalizedStatus)) {
            user.setVerified(false);
        } else {
            throw new IllegalArgumentException("Unsupported status: " + status);
        }

        return userRepo.save(user);
    }

    public List<UserEntity> bulkUpdateUserStatus(List<Integer> userIds, String status) {
        if (userIds == null || userIds.isEmpty()) {
            throw new IllegalArgumentException("At least one user must be selected");
        }

        return userIds.stream()
                .map(id -> updateUserStatus(id, status))
                .toList();
    }

    public String deleteUser(int id) {
        String msg = " ";
        userRepo.deleteById(id);
        msg = "User successfully deleted!";
        return msg;
    }

}
