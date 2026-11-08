# Respondent evaluation demo

Share the frontend's `/demo` URL with respondents. The landing and login pages also link to it. No registration, shared password, or production login is needed: **Enter demo account** opens an isolated client persona in the actual application interface.

The demo uses the same layout, chatbot, case submission form, legal workspace, appointment tools, and document manager as the main site. A banner identifies demo mode. The floating **Quests** button at the bottom left opens instructions, progress, navigation, and hints. Close the window with the same button, its close control, or Escape while focused inside it. On smaller screens, opening a quest closes the window to leave room for the task. Revealed hints remain available when it reopens.

The quest panel shows eight required tasks, two optional tasks, and a button for the next required task. Case Search, the optional appointment proposal, and opening the original PDF each unlock a short question about what the respondent saw. These quests check off after the respondent saves an answer. The questions are ungraded.

1. **Try normal queries:** ask a Philippine legal question with **Case Search OFF** and review the explanation. Try a follow-up. English and Cebuano replies and quick summaries use the existing AI pipeline. The quest's button opens the chatbot in this mode.
2. **Try Case Search:** search for Supreme Court decisions involving **civil cases**, such as recovery of an unpaid loan or breach of contract, with **Case Search ON**. Review the returned sources or no-match message, then answer the question in Quests. A successful search can unlock the question even with zero matches. Both chatbot quests are required before case creation.
3. **Optional AI drafting.** Generate a draft from fictional case facts and apply at least one suggestion. You can practice again after submitting your case.
4. Use **Case Workspace > Submit New Case** to create a practice **civil** case and select an existing verified lawyer.
5. Explore **Overview** and **Appointment Calendar**, then enter a workspace note. Notes save automatically.
6. **Optional appointment proposal.** Accept the simulated lawyer's sample proposal or send an online or face-to-face proposal. Check its status and answer the question in Quests.
7. In **Documents**, choose **Send code** and enter the six-digit practice code shown on screen. The workspace unlock lasts 15 minutes and applies until you reload or leave the demo.
8. Download **G.R. No. 233460.pdf** from the sample banner. Use **Select Files** and **Upload All**, or drag and drop the PDF. PDFs up to 10 MB are supported.
9. Generate a live summary from the uploaded PDF.
10. Use **Preview** or **Download** and enter the practice code for that action. Answer what happened in Quests and compare the PDF with the summary. Return to the research team's survey after the required quests are complete.

Every quest links to the relevant screen. Quests unlock when their prerequisites are complete, and completed quests can be revisited. Failed AI requests and incorrect practice codes leave the relevant quest incomplete. Replacing the PDF clears the prior summary and PDF question answer, and reopens both document quests.

Each quest also has an optional **Hint** button. Hints reveal in three stages: where to start, concrete steps, and an example or troubleshooting guidance. **Next hint** reveals more; **Hide hints** collapses the guidance. Examples for the chatbot, case scenario, and workspace note have a **Copy example** button. Revealed hints remain available after closing the quest panel or refreshing the tab. Reading or copying hints does not complete quests or bypass prerequisites. Reset clears hint progress for the next respondent.

The case-creation example explicitly references **G.R. No. 233460 (Fernandez v. Court of Appeals)** as inspiration for a public-confrontation and civil-damages scenario. Its people, location, date, and surrounding dispute are fictionalized. It asks for assessment of a possible civil claim after a related acquittal, without assigning a legal outcome or treating the fictional facts as part of the supplied decision.

Existing demo sessions keep their cases, files, notes, and chats. The former combined chatbot quest is migrated using saved successful replies, so an untested chatbot mode remains available to complete.

## Isolation and persistence

- The demo does not create database users or cases, send email, write Firebase messages, notify lawyers, or change a real account's authentication storage.
- `/api/demo/lawyers` reads verified profiles and returns only a demo identifier, name, city, and specializations. No private account fields or case records are returned.
- `/api/demo/chat` runs the existing chat pipeline without real-account authentication, chat-history writes, or audit writes. Chat context is sent from the demo session only.
- `/api/demo/case-draft` generates title and description suggestions without a production account or case record. Document verification runs entirely in the browser and displays practice codes on screen.
- `/api/demo/summary` extracts the submitted PDF and calls the same summary service as the full application. The upload is processed transiently and is not written to server document storage or linked to a real case. The existing prompt treats PDF contents as untrusted source material, not instructions.
- Progress, chat, notes, and the practice case are saved in sessionStorage. The uploaded PDF is saved in browser IndexedDB under that session's random identifier so refresh can restore it. **Reset for next respondent** clears the current session's file and starts a new identity. Use Reset on shared devices; browser storage can outlive a closed tab.
- Existing components receive explicit demo services through a React context mounted only under `/demo`. Outside that context they continue to use their normal authentication and production services. The demo does not change the global network layer or substitute a real login token.
- Directory searches and profile modals use verified-lawyer snapshots. Appointment proposals, edits, acceptance, deletion, and inbox messages are local simulations. Profile edits are local. Password changes are simulated. These actions never call production mutation endpoints, upload profile photos, or write Firebase messages.
- Chat history is local to this demo. Starting a new conversation preserves earlier demo chats; workspace AI requests also appear in the local history. Reset clears all demo conversations, appointments, practice messages, and profile edits.
- The demo reuses the actual application UI, AI answer cards, verified-source display, Markdown renderer, chat processing, and document summarization. It does not exercise production case-submission persistence or actual two-person lawyer collaboration.
- Quest progress and question answers stay in the respondent's tab and are cleared by **Reset for next respondent**. The research team's separate survey collects its own responses.

## Running it

Start the normal frontend and backend. A backend restart is required after installing this change. The AI service must have its usual DeepSeek configuration; verified case search also requires a healthy RAG service and verified corpus. The database needs at least one credential-verified lawyer for case creation. An unavailable or empty directory has an explicit retry state; fictitious lawyer profiles are not silently substituted.

`DEMO_ENABLED=true` is the default. Set `DEMO_ENABLED=false` and restart the backend to disable its demo endpoints after the survey. This switch does not affect the rest of the application. These public evaluation endpoints should only stay enabled while the demo is needed.

Validation:

```powershell
cd ally-frontend
npm run build
node --test src/demo/demoState.test.mjs
npx eslint src/demo/demoState.js src/demo/demoService.js src/demo/demoRuntime.js src/demo/DemoContext.js src/pages/RespondentDemoPage.jsx
cd ../Ally
mvn '-Dtest=DemoIsolationTest,DocumentSummaryServiceTest,DeepSeekChatServiceTest' test
```
