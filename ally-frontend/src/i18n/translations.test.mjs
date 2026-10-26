import test from 'node:test';
import assert from 'node:assert/strict';
import { translateText } from './translations.js';

test('keeps English copy unchanged', () => {
  assert.equal(translateText('New Chat', 'en'), 'New Chat');
});

test('translates known interface copy to Bisaya', () => {
  assert.equal(translateText('New Chat', 'ceb'), 'Bag-ong Chat');
  assert.equal(translateText('Find Lawyer', 'ceb'), 'Pangita og Abogado');
});

test('preserves surrounding whitespace', () => {
  assert.equal(translateText('  Settings\n', 'ceb'), '  Mga Setting\n');
});

test('translates supported dynamic labels', () => {
  assert.equal(translateText('Page 2 of 5', 'ceb'), 'Panid 2 sa 5');
  assert.equal(translateText('3 minutes ago', 'ceb'), '3 ka minuto ang milabay');
});

test('falls back to the original copy when no translation exists', () => {
  assert.equal(translateText('ALLY', 'ceb'), 'ALLY');
});
