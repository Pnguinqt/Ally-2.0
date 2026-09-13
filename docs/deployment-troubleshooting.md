# ALLY deployment checks

The backend changes must be deployed before the browser can use them. No Render settings or deployments were changed by this code update.

## Findings

- There were two global CORS processing paths (a servlet filter and Spring Security), plus controller-level wildcard/local-only annotations. PATCH was missing. The old defaults already included Vercel; missing CORS headers can also mean Render returned a proxy response or the Java process never responded.
- Read-only production preflight probes timed out after 25 and 55 seconds with no HTTP response. This does not prove an OOM, restart, or a particular provider failure. Inspect Render events and runtime logs around the failed request for process exit codes, memory exhaustion, startup errors, database connection failures and deployment restarts.
- RAG defaulted to localhost, which on Render means the Render container, not a developer laptop. Its shared HTTP client could wait 30 seconds per connection/read; the RAG timeout property was not used by that client.
- OTP delivery uses the MailerSend HTTPS API, not JavaMail/SMTP. SMTP settings could not fix that call. The old sender was hardcoded and delivery had no application-configured transport deadline.
- The frontend already reset submitting in finally, but an unresolved fetch could keep it waiting. It also mislabeled any error mentioning email as a duplicate address.
- SQL initialization references users; schema.sql must run after Hibernate creates mapped tables on a fresh database. Database credentials and connectivity remain deployment requirements.

## Render environment

Required for database-backed registration:

| Name | Configuration |
| --- | --- |
| DB_URL | Reachable MySQL JDBC connection URL, with the database provider's required TLS options |
| DB_USERNAME | Database username |
| DB_PASSWORD | Database password (secret) |
| MAILERSEND_API_KEY | MailerSend API token with sending permission (secret) |
| MAILERSEND_FROM_EMAIL | Sender on your verified MailerSend domain |
| MAILERSEND_FROM_NAME | Sender display name; defaults to Ally Team |
| FRONTEND_URL | https://ally-frontend-eta.vercel.app |
| LOCAL_DEV | false; also enable email verification in ALLY system settings |
| RAG_ENABLED | false until FastAPI is publicly reachable |

Optional settings:

- MAILERSEND_TIMEOUT_MS defaults to 15000; email connect timeout is 5000 ms.
- RAG_SERVICE_URL: set to the deployed FastAPI URL only when it exists. For laptop development set RAG_ENABLED=true and the correct local URL/port.
- RAG_SERVICE_TIMEOUT defaults to 10000; RAG_HEALTH_TIMEOUT defaults to 2000 (milliseconds). The health probe has bounded connect/read waits.
- DEEPSEEK_API_KEY is required for AI replies, not registration. DEEPSEEK_BASE_URL and DEEPSEEK_MODEL retain their existing defaults.
- PORT is supplied by Render; Spring uses it.
- STORAGE_TYPE defaults to local. Firebase uploads require STORAGE_TYPE=firebase, FIREBASE_KEY_PATH pointing to the mounted secret file, and FIREBASE_STORAGE_BUCKET. Local upload storage needs a persistent disk if files must survive redeploys.
- Self-pinging is disabled by default. If explicitly enabled with ALLY_KEEP_ALIVE_ENABLED=true, set BACKEND_URL=https://ally-backend-yspl.onrender.com. Calls have 5-second connect/read limits.

SMTP_DOMAIN_ID and SMTP settings are not used for OTP delivery. CORS_ALLOWED_ORIGIN_PATTERNS is no longer used: SecurityConfig explicitly allows only the requested production origin and http://localhost:5173. No wildcard origins are allowed.

MailerSend sender requirements and request format: https://developers.mailersend.com/api/v1/email

## Vercel

Set VITE_API_BASE_URL=https://ally-backend-yspl.onrender.com and rebuild/redeploy the frontend; Vite embeds this value at build time. Do not configure a laptop address as a production RAG endpoint.

## Commit and redeploy

1. Review changes in your IDE, preserving unrelated working files. Stage only the deployment changes. Use git add -p for tracked files if there are other edits; explicitly add the new EmailDeliveryException.java, Deployment test directory and this document. Never stage .env or secret JSON files.
2. Commit and push to the branch connected to Render/Vercel:

   ```sh
   git commit -m "Fix deployment CORS and registration failure handling"
   git push
   ```

3. In Render verify the service root directory is Ally and the Dockerfile is Ally/Dockerfile relative to the repository (Dockerfile relative to that root). Set the variables above and deploy the pushed commit.
4. Set Render's health check path to /api/chat/health. With RAG disabled it should return HTTP 200 with status=running, ragService=down and ragAvailable=false. Inspect startup logs and confirm the application is listening on PORT. If the process resets, check Render events, memory limits and database accessibility; CORS code cannot add headers to a proxy-generated failure while Java is down.
5. Redeploy Vercel from the same intended commit with root ally-frontend, build command npm run build and output dist.
6. In browser DevTools confirm OPTIONS requests return the exact Access-Control-Allow-Origin, Access-Control-Allow-Credentials=true, and permitted methods including PATCH. GET /api/chat/health must have CORS headers even with RAG down.
7. Manually test registration with an authorized test address: success proceeds to OTP verification; provider/configuration failure returns 503 with a readable message; database failures return controlled errors; duplicate conflicts return 409. A stalled request times out in the browser after 60 seconds and submitting clears in finally. Do not automatically retry registration, since a timed-out request may already have been processed.
8. OTPs currently live in server memory; a restart clears pending registrations. Retry registration after a restart if necessary.

## Local validation

From Ally run Maven with -Dtest=DeploymentWebTest,ExternalServiceTest,RegistrationCleanupTest test. These tests mock external providers and database calls, so they do not send email or create accounts. From ally-frontend run npm run build. Production provider credentials, database availability, and actual email delivery still require the post-deploy checks above.

## Files changed

- Ally/src/main/java/com/wachichaw/Config/SecurityConfig.java: one Spring Security CORS source, exact origins, credentials, all six methods, explicit preflight permission and request-header allowlist.
- Ally/src/main/java/com/wachichaw/Weka/Controller/LawyerRecommendationController.java, IntegratedCaseController.java, and Ally/src/main/java/com/wachichaw/Firebase/FirebaseStorageController.java: remove conflicting controller CORS annotations.
- Ally/src/main/java/com/wachichaw/AllyRAG/RagService.java and Ally/src/main/java/com/wachichaw/AllyChatAI/Controller/ChatController.java: disable undeployed RAG explicitly; bound health/search/validation waits; return controlled RAG status with HTTP 200 from the chat health route.
- Ally/src/main/java/com/wachichaw/EmailConfig/Service/EmailService.java and new EmailDeliveryException.java: configure verified sender and bounded HTTPS transport, convert provider/network errors into a dedicated exception without logging provider response bodies.
- Ally/src/main/java/com/wachichaw/EmailConfig/Service/VerificationService.java: remove OTP debug output.
- Ally/src/main/java/com/wachichaw/User/Service/UserService.java: clean pending OTP state after delivery failure; remove client OTP debug output.
- Ally/src/main/java/com/wachichaw/User/Controller/UserController.java: controlled registration responses for email, database and other errors; success returns email/verified only, never a password-bearing entity.
- Ally/src/main/java/com/wachichaw/Config/KeepAliveConfig.java: make self-ping opt-in, use BACKEND_URL and bounded timeouts.
- Ally/src/main/resources/application.properties: wire RAG and MailerSend variables, remove obsolete SMTP/CORS-pattern settings, bound database connections and defer SQL initialization until Hibernate creates tables. Preserve the existing password-default removal.
- Ally/.env.example: nonsecret local RAG and MailerSend configuration examples.
- ally-frontend/src/components/ClientRegistrationForm.jsx: duplicate-submit guard, 60-second abort timeout, clear timer/loading in finally, separate duplicate-account errors from email-delivery errors.
- Ally/src/test/java/com/wachichaw/Deployment/DeploymentWebTest.java, ExternalServiceTest.java, RegistrationCleanupTest.java: deployment regression tests.
- docs/deployment-troubleshooting.md: this deployment runbook.
