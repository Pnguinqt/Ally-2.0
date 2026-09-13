package com.wachichaw.Config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.Scheduled;

import java.net.HttpURLConnection;
import java.net.URL;

@Configuration
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name = "ally.keep-alive.enabled", havingValue = "true")
public class KeepAliveConfig {

    @org.springframework.beans.factory.annotation.Value("${BACKEND_URL:http://localhost:8080}")
    private String backendUrl;

    @Scheduled(fixedRate = 4 * 60 * 1000) // every 4 minutes
    public void pingSelf() {
        try {
            URL url = new URL(backendUrl.replaceAll("/+$", "") + "/api/chat/health");
            HttpURLConnection con = (HttpURLConnection) url.openConnection();
            con.setConnectTimeout(5000);
            con.setReadTimeout(5000);
            con.setRequestMethod("GET");
            int responseCode = con.getResponseCode();
            con.disconnect();
            System.out.println("Self-ping response: " + responseCode);
        } catch (Exception e) {
            System.out.println("Self-ping failed: " + e.getMessage());
        }
    }
}
