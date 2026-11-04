
package com.wachichaw.Config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;

@Configuration
public class FirebaseConfig {

    @Value("${firebase.service-account.path:}")
    private String serviceAccountPath;

    @Value("${firebase.storage.bucket:}")
    private String storageBucket;

    @Bean
    public FirebaseApp firebaseApp() throws IOException {

        // Reuse Firebase if it has already been initialized.
        if (!FirebaseApp.getApps().isEmpty()) {
            return FirebaseApp.getInstance();
        }

        GoogleCredentials credentials;

        if (serviceAccountPath != null
                && !serviceAccountPath.isBlank()) {

            InputStream serviceAccount;

            if (serviceAccountPath.startsWith("classpath:")) {

                String path = serviceAccountPath
                        .replace("classpath:", "");

                serviceAccount = getClass()
                        .getClassLoader()
                        .getResourceAsStream(path);

                if (serviceAccount == null) {
                    throw new IOException(
                            "Firebase service account not found: " + path);
                }

            } else {

                String filePath = serviceAccountPath
                        .replace("file:", "");

                File file = new File(filePath);

                if (!file.exists()) {
                    throw new IOException(
                            "Firebase service account file does not exist: "
                                    + filePath);
                }

                serviceAccount = new FileInputStream(file);
            }

            try (InputStream input = serviceAccount) {
                credentials = GoogleCredentials.fromStream(input);
            }

        } else {

            // Uses Application Default Credentials.
            credentials = GoogleCredentials.getApplicationDefault();
        }

        FirebaseOptions.Builder optionsBuilder = FirebaseOptions.builder()
                .setCredentials(credentials);

        if (storageBucket != null && !storageBucket.isBlank()) {
            optionsBuilder.setStorageBucket(storageBucket);
        }

        FirebaseApp app = FirebaseApp.initializeApp(
                optionsBuilder.build());

        System.out.println("Firebase Admin SDK initialized successfully.");

        return app;
    }
}
