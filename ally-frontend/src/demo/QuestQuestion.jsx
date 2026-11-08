import { useState } from 'react';

export default function QuestQuestion({ quest, onAnswer }) {
  const [answer, setAnswer] = useState('');
  const id = `quest-question-${quest.id}`;

  return <form className="mt-3 rounded-lg border border-blue-200 bg-white p-3" onSubmit={event => {
    event.preventDefault();
    if (answer) onAnswer(answer);
  }}>
    <fieldset id={id} tabIndex={-1} className="space-y-2 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
      <legend className="mb-2 text-sm font-semibold text-gray-900">{quest.question.prompt}</legend>
      {quest.question.options.map(option => <label key={option} className="flex cursor-pointer items-start gap-2 text-sm text-gray-700">
        <input type="radio" name={id} value={option} checked={answer === option} onChange={event => setAnswer(event.target.value)}
          className="mt-1 shrink-0 accent-blue-600" />
        <span>{option}</span>
      </label>)}
    </fieldset>
    <button type="submit" disabled={!answer} className="mt-3 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
      Save answer
    </button>
  </form>;
}
