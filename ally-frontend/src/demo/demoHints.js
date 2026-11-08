export const questHints = {
  chat: [
    { title: 'Start in normal chat mode', text: 'Choose Open normal queries. Case Search should be OFF; the toggle is gray when it is off.' },
    { title: 'Ask for an explanation', text: 'Type a Philippine legal question in the chat box, then press Enter or use the send arrow. Wait for a successful reply. You can then ask a follow-up such as “Can you explain that more simply?”' },
    { title: 'Try this example question', text: 'Copy this question into the chat box. This quest completes after a successful reply with Case Search OFF.', example: 'What should I prepare before consulting a lawyer about an unpaid personal loan in the Philippines?' },
  ],
  'case-search': [
    { title: 'Turn on case retrieval', text: 'Choose Open Case Search. Check that the blue toggle says Case Search: ON before sending your question.' },
    { title: 'Search for civil cases', text: 'Ask for Philippine Supreme Court decisions involving a civil dispute, such as recovery of an unpaid loan or breach of contract. Review the results, then answer what you saw in Quests. A search with no matches still counts. A greeting or failed request leaves the question locked.' },
    { title: 'Try this civil case search prompt', text: 'Copy this into the chat box with Case Search ON to research civil cases. If case search is unavailable, use Retry case search and try again when the service recovers.', example: 'Find Philippine Supreme Court decisions in civil cases involving the recovery of an unpaid loan under a written agreement.' },
  ],
  draft: [
    { title: 'Open the case form', text: 'Choose Open AI drafting and find the AI writing assistant. If you already submitted your case, this opens a practice form.' },
    { title: 'Generate a draft', text: 'Write at least 20 characters of fictional facts in Additional notes and choose Suggest title & description.', example: 'At a fictional community meeting, several residents heard a volunteer make remarks about the treasurer. The treasurer wants advice on a possible civil claim and has meeting notes and witness accounts.' },
    { title: 'Apply a suggestion', text: 'Check the suggested wording against your facts, then select Use title, Use description, or Use both. Edit the populated fields as needed.' },
  ],
  case: [
    { title: 'Open the usual case form', text: 'Complete both chatbot quests, then choose Create civil case. You can also open Case Workspace from the sidebar and select Submit New Case.' },
    { title: 'Fill in the required fields', text: 'Keep the Case Type as CIVIL and choose an existing lawyer. You can enter fictional facts in the AI writing assistant, choose Suggest title & description, and review and apply the draft. The title needs at least 5 characters and the description needs 20–1000 characters. Click Submit Case. Lawyer acceptance is simulated.' },
    { title: 'Adapt G.R. No. 233460', text: 'Use G.R. No. 233460 (Fernandez v. Court of Appeals) as inspiration for the public-confrontation and civil-damages theme. Change the people, place, date, and surrounding dispute. The example below is fictional and concerns a possible civil claim, not a new criminal charge. Copy the title and description into their respective fields, then choose an existing lawyer.', example: 'Case title: Possible civil damages over insults at a community meeting\n\nCase description: On 14 September 2025, Marco Reyes, a community committee treasurer in Iloilo City, was allegedly insulted by volunteer instructor Leah Santos in front of several residents during a disagreement over an activity budget. Leah says her remarks expressed frustration and were not directed at Marco. A related criminal complaint ended in acquittal because guilt was not proven beyond reasonable doubt. Marco wants a lawyer to assess a possible civil claim for the humiliation and distress he experienced. He has witness accounts, meeting notes, and related messages. No civil damages have been awarded in this fictional scenario.' },
  ],
  workspace: [
    { title: 'Select your practice case', text: 'Open Case Workspace from the sidebar, or use Open workspace. Select your practice case if it is not already selected.' },
    { title: 'Explore all three required tools', text: 'Read Overview, open Appointment Calendar, then open Notes and enter a nonempty note. Notes save automatically.' },
    { title: 'Try this case note', text: 'Paste or write your own note in Workspace Notes. This quest completes once you have visited Overview and Appointment Calendar and entered a note.', example: 'Gather the written loan agreement, payment records, and reminders. Ask the lawyer which documents are needed for the consultation.' },
  ],
  appointment: [
    { title: 'Open the calendar', text: 'Choose Open appointment calendar to see appointments for your practice case.' },
    { title: 'Accept the sample proposal', text: 'Find the simulated case conference and choose Accept proposal. You can also use Propose appointment to send your own proposal.' },
    { title: 'Check the status', text: 'If sending your own proposal, enter a title, future start and end times, and either a practice meeting link or a fictional venue. After accepting or sending a proposal, check its status and answer the question in Quests.' },
  ],
  'unlock-documents': [
    { title: 'Request a practice code', text: 'Open Documents and choose Send code. The six digits appear above the input.' },
    { title: 'Enter the code', text: 'Type the displayed digits into Practice code and choose Unlock documents. The document workspace stays open for 15 minutes.' },
    { title: 'Get a fresh code if needed', text: 'If the code expires or you make too many incorrect attempts, request a new one. Use the digits currently displayed.' },
  ],
  upload: [
    { title: 'Find the sample PDF', text: 'Choose Go to documents, then choose Download sample PDF to save G.R. No. 233460.pdf. If Documents has locked again, request a fresh practice code.' },
    { title: 'Select the downloaded file', text: 'Click Select Files and choose the PDF you just downloaded, or drag it into the upload area. It will appear in Selected Files. Selecting a file only adds it to the upload queue.' },
    { title: 'Finish the upload', text: 'Click Upload All and wait for the PDF to appear under Documents. That completes the quest. Use a valid PDF up to 10 MB; the supplied sample is ready to use.' },
  ],
  summary: [
    { title: 'Use the uploaded document row', text: 'Choose Summarize PDF to open the Documents tab. Find your uploaded PDF in the Documents list below the upload area.' },
    { title: 'Open the AI summary', text: 'Click the purple Summarize button beside the uploaded PDF. A side panel opens. Wait while the document is read and the summary is generated.' },
    { title: 'Review the result', text: 'Read the summary and check the key points against the original in the next quest. If the summary fails, use Try again. The quest completes when a summary is successfully generated.' },
  ],
  'review-document': [
    { title: 'Find the original', text: 'Choose Open document tools. On the uploaded PDF’s row, select the eye icon to Preview or the down arrow to Download.' },
    { title: 'Verify the file action', text: 'Enter the six-digit practice code shown in the dialog, then choose View preview or Download file. This action has its own code.' },
    { title: 'Check what opened', text: 'Answer what happened after verification in Quests. Then look for the key facts and the court’s ruling in the PDF and compare those details with the AI summary.' },
  ],
};
