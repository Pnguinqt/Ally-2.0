package com.wachichaw.Client.Entity;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;

import com.wachichaw.Client.Entity.ClientEntity;

@Service
public class TempClient{
    private final Map<String, ClientEntity> unverifiedUsers = new ConcurrentHashMap<>();

    public void saveUnverifiedUser(String token, ClientEntity user) {
        unverifiedUsers.put(token, user);
    }

    public ClientEntity getUnverifiedUser(String token) {
        ClientEntity user = unverifiedUsers.get(token);
        return user;
    }
    public String getTokenByEmail(String email) {
    for (Map.Entry<String, ClientEntity> entry : unverifiedUsers.entrySet()) {
        if (entry.getValue().getEmail().equalsIgnoreCase(email)) {
            return entry.getKey();
        }
    }
    return null;
}
  

    public void removeUnverifiedUser(String token) {
        unverifiedUsers.remove(token);
    }
}
