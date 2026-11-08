import test from 'node:test';
import assert from 'node:assert/strict';
import { integerToFrenchWords, formatAmountInWords } from './numberToWords';

test('converts basic numbers 0 to 20', () => {
  assert.equal(integerToFrenchWords(0), 'zéro');
  assert.equal(integerToFrenchWords(1), 'un');
  assert.equal(integerToFrenchWords(10), 'dix');
  assert.equal(integerToFrenchWords(11), 'onze');
  assert.equal(integerToFrenchWords(15), 'quinze');
  assert.equal(integerToFrenchWords(19), 'dix-neuf');
});

test('handles tens and et-un combinations', () => {
  assert.equal(integerToFrenchWords(20), 'vingt');
  assert.equal(integerToFrenchWords(21), 'vingt et un');
  assert.equal(integerToFrenchWords(35), 'trente-cinq');
  assert.equal(integerToFrenchWords(70), 'soixante-dix');
  assert.equal(integerToFrenchWords(71), 'soixante et onze');
  assert.equal(integerToFrenchWords(75), 'soixante-quinze');
});

test('handles quatre-vingts and quatre-vingt-un', () => {
  assert.equal(integerToFrenchWords(80), 'quatre-vingts');
  assert.equal(integerToFrenchWords(81), 'quatre-vingt-un');
  assert.equal(integerToFrenchWords(85), 'quatre-vingt-cinq');
  assert.equal(integerToFrenchWords(90), 'quatre-vingt-dix');
  assert.equal(integerToFrenchWords(99), 'quatre-vingt-dix-neuf');
});

test('handles cents agreements and prompt example 12 500', () => {
  assert.equal(integerToFrenchWords(100), 'cent');
  assert.equal(integerToFrenchWords(200), 'deux cents');
  assert.equal(integerToFrenchWords(205), 'deux cent cinq');
  assert.equal(integerToFrenchWords(500), 'cinq cents');
  // Exact user prompt requirement: "ex. 12 500 = « douze mille cinq cents »"
  assert.equal(integerToFrenchWords(12500), 'douze mille cinq cents');
  assert.equal(integerToFrenchWords(1000), 'mille');
  assert.equal(integerToFrenchWords(2000), 'deux mille');
  assert.equal(integerToFrenchWords(1000000), 'un million');
  assert.equal(integerToFrenchWords(3000000), 'trois millions');
});

test('formatAmountInWords handles FC and USD with decimals', () => {
  assert.equal(
    formatAmountInWords(12500, 'USD'),
    'douze mille cinq cents dollars américains'
  );
  assert.equal(
    formatAmountInWords(12500, 'FC'),
    'douze mille cinq cents francs congolais'
  );
  assert.equal(
    formatAmountInWords(1, 'USD'),
    'un dollar américain'
  );
  assert.equal(
    formatAmountInWords(50.25, 'USD'),
    'cinquante dollars américains et vingt-cinq centimes'
  );
});
