# Respondent evaluation demo

Share the frontend's `/demo` URL with respondents. The landing and login pages also link to it. No registration, shared password, or production login is needed: **Enter demo account** opens an isolated client persona in the actual application interface.

The demo renders the existing `PageLayout`, `ChatSidebar`, `NavigationBar`, chatbot, My Cases page, submission modal, legal workspace, hearing calendar, document manager, directory, appointments, settings, notification dropdown, and inbox components. A small banner identifies demo mode. **Quests** opens a compact floating window on the right with instructions, progress, navigation, and hints. Open or close it using the banner button, the floating Quests button, its close control, or Escape while focused inside it. It stays open when following a quest or using the sidebar, and keeps expanded hints when closed and reopened. It has its own scrolling area and leaves the app interactive. Sidebar collapse/expand and mobile navigation work normally.

The guided sequence is:

1. **Try normal queries:** ask a Philippine legal question with **Case Search OFF** and review the explanation. Try a follow-up. English and Cebuano replies and quick summaries use the existing AI pipeline. The quest's button opens the chatbot in this mode.
2. **Try Case Search:** search for Supreme Court decisions involving **civil cases**, such as recovery of an unpaid loan or breach of contract, with **Case Search ON** and review returned sources or the no-match message. Its button turns Case Search on. A successful search can complete this quest even with zero matches; greetings and failed requests do not count. Each chatbot mode completes only its own quest, and both are required before case creation.
3. Use **My Cases > Submit New Case** to create a practice **civil** case and choose a read-only copy of an existing verified lawyer profile. The original form, validation, case cards, status filters, tracker, details, and editing controls are retained.
4. Explore Overview and Hearings, then enter a nonempty Workspace Note (autosaved, as in the real app). Lawyer acceptance and hearing details are simulated so respondents can continue without waiting for a real lawyer.
5. Download **G.R. No. 233460.pdf** from the sample banner in the original document manager. Use **Select Files** and **Upload All**, or its existing drag/drop controls. The bundled PDF is an exact copy of the supplied evaluation file at `ally-frontend/public/demo/GR-233460.pdf`. PDFs up to 10 MB are supported. Document search, file-type filters, preview, download, and delete remain available.
6. Generate a live document summary, compare it with the original PDF, and finish the walkthrough before returning to the research team's survey.

Every quest includes a button to its area. Later quests unlock after earlier tasks are completed. Completed quests can be revisited. Failed AI requests do not complete a quest. Replacing the PDF clears the prior summary and reopens the summary quest.

Each quest also has an optional **Hint** button. Hints reveal in three stages: where to start, concrete steps, and an example or troubleshooting guidance. **Next hint** reveals more; **Hide hints** collapses the guidance. Examples for the chatbot, case scenario, and workspace note have a **Copy example** button. Revealed hints remain available after closing the quest panel or refreshing the tab. Reading or copying hints does not complete quests or bypass prerequisites. Reset clears hint progress for the next respondent.

The case-creation example explicitly references **G.R. No. 233460 (Fernandez v. Court of Appeals)** as inspiration for a public-confrontation and civil-damages scenario. Its people, location, date, and surrounding dispute are fictionalized. It asks for assessment of a possible civil claim after a related acquittal, without assigning a legal outcome or treating the fictional facts as part of the supplied decision.

Existing demo sessions keep their cases, files, notes, and chats. The former combined chatbot quest is migrated using saved successful replies, so an untested chatbot mode remains available to complete.

## Isolation and persistence

- The demo does not create database users or cases, send email, write Firebase messages, notify lawyers, or change a real account's authentication storage.
- `/api/demo/lawyers` reads verified profiles and returns only a demo identifier, name, city, and specializations. No private account fields or case records are returned.
- `/api/demo/chat` runs the existing chat pipeline without real-account authentication, chat-history writes, or audit writes. Chat context is sent from the demo session only.
- `/api/demo/summary` extracts the submitted PDF and calls the same summary service as the full application. The upload is processed transiently and is not written to server document storage or linked to a real case. The existing prompt treats PDF contents as untrusted source material, not instructions.
- Progress, chat, notes, and the practice case are saved in sessionStorage. The uploaded PDF is saved in browser IndexedDB under that session's random identifier so refresh can restore it. **Reset for next respondent** clears the current session's file and starts a new identity. Use Reset on shared devices; browser storage can outlive a closed tab.
- Existing components receive explicit demo services through a React context mounted only under `/demo`. Outside that context they continue to use their normal authentication and production services. The demo does not change the global network layer or substitute a real login token.
- The original sidebar destinations remain available. Directory searches and profile modals use existing verified-lawyer snapshots. Practice appointment booking/rescheduling/cancellation and inbox messages are local simulations. Profile edits are local; password changes are explicitly simulated. These actions never call production mutation endpoints, upload profile photos, or write Firebase messages.
- Chat history is local to this demo. Starting a new conversation preserves earlier demo chats; workspace AI requests also appear in the local history. Reset clears all demo conversations, appointments, practice messages, and profile edits.
- The demo reuses the actual application UI, AI answer cards, verified-source display, Markdown renderer, chat processing, and document summarization. It does not exercise production case-submission persistence or actual two-person lawyer collaboration.
- Completion is local to the respondent's tab. No survey answers or centralized completion analytics are collected. Respondents return to the survey supplied separately by the research team.

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
