export const questHints = {
  chat: [
    { title: 'Start in normal chat mode', text: 'Choose Open normal queries. Case Search should be OFF; the toggle is gray when it is off.' },
    { title: 'Ask for an explanation', text: 'Type a Philippine legal question in the chat box, then press Enter or use the send arrow. Wait for a successful reply. You can then ask a follow-up such as “Can you explain that more simply?”' },
    { title: 'Try this example question', text: 'Copy this question into the chat box. This quest completes after a successful reply with Case Search OFF.', example: 'What should I prepare before consulting a lawyer about an unpaid personal loan in the Philippines?' },
  ],
  'case-search': [
    { title: 'Turn on case retrieval', text: 'Choose Open Case Search. Check that the blue toggle says Case Search: ON before sending your question.' },
    { title: 'Search for civil cases', text: 'Ask for Philippine Supreme Court decisions involving a civil dispute, such as recovery of an unpaid loan or breach of contract. Review the returned cases and any official source links. A successful search with no matching cases also completes this quest; a greeting or a failed request does not.' },
    { title: 'Try this civil case search prompt', text: 'Copy this into the chat box with Case Search ON to research civil cases. If case search is unavailable, use Retry case search and try again when the service recovers.', example: 'Find Philippine Supreme Court decisions in civil cases involving the recovery of an unpaid loan under a written agreement.' },
  ],
  case: [
    { title: 'Open the usual case form', text: 'Complete both chatbot quests, then choose Create civil case. You can also open Case Workspace from the sidebar and select Submit New Case.' },
    { title: 'Fill in the required fields', text: 'Keep the Case Type as CIVIL, choose an existing lawyer, enter a title of at least 5 characters, and write a description of 20–1000 characters. Click Submit Case. Lawyer acceptance is simulated for the demo.' },
    { title: 'Adapt G.R. No. 233460', text: 'Use G.R. No. 233460 (Fernandez v. Court of Appeals) as inspiration for the public-confrontation and civil-damages theme. Change the people, place, date, and surrounding dispute. The example below is fictional and concerns a possible civil claim, not a new criminal charge. Copy the title and description into their respective fields, then choose an existing lawyer.', example: 'Case title: Possible civil damages over insults at a community meeting\n\nCase description: On 14 September 2025, Marco Reyes, a community committee treasurer in Iloilo City, was allegedly insulted by volunteer instructor Leah Santos in front of several residents during a disagreement over an activity budget. Leah says her remarks expressed frustration and were not directed at Marco. A related criminal complaint ended in acquittal because guilt was not proven beyond reasonable doubt. Marco wants a lawyer to assess a possible civil claim for the humiliation and distress he experienced. He has witness accounts, meeting notes, and related messages. No civil damages have been awarded in this fictional scenario.' },
  ],
  workspace: [
    { title: 'Select your practice case', text: 'Open Case Workspace from the sidebar, or use Open workspace. Select your practice case if it is not already selected.' },
    { title: 'Explore all three required tools', text: 'Read the Overview tab, open Appointment Calendar to review the example calendar, then open Notes. Enter a nonempty workspace note. Notes save automatically; there is no Save button.' },
    { title: 'Try this case note', text: 'Paste or write your own note in Workspace Notes. This quest completes once you have visited Overview and Appointment Calendar and entered a note.', example: 'Gather the written loan agreement, payment records, and reminders. Ask the lawyer which documents are needed for the consultation.' },
  ],
  upload: [
    { title: 'Find the evaluation PDF', text: 'Complete the workspace quest, then choose Go to documents. In the Documents tab, click Download sample PDF to save G.R. No. 233460.pdf to your device.' },
    { title: 'Select the downloaded file', text: 'Click Select Files and choose the PDF you just downloaded, or drag it into the upload area. It will appear in Selected Files. Selecting a file only adds it to the upload queue.' },
    { title: 'Finish the upload', text: 'Click Upload All and wait for the PDF to appear under Documents. That completes the quest. Use a valid PDF up to 10 MB; the supplied sample is ready to use.' },
  ],
  summary: [
    { title: 'Use the uploaded document row', text: 'Choose Summarize PDF to open the Documents tab. Find your uploaded PDF in the Documents list below the upload area.' },
    { title: 'Open the AI summary', text: 'Click the purple Summarize button beside the uploaded PDF. A side panel opens. Wait while the document is read and the summary is generated.' },
    { title: 'Review the result', text: 'Read the summary, then close the panel and use Preview or Download to compare it with the original. If the summary fails, use Try again in the panel. The quest completes only when a summary is successfully generated.' },
  ],
};
