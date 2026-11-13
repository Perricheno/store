import test from 'node:test';
import assert from 'node:assert/strict';
import { ean13Modules, isEan13 } from '../src/barcode';

test('EAN-13 validates check digits and encodes the expected modules', () => {
  assert.equal(isEan13('4006381333931'), true);
  assert.equal(isEan13('0000000000000'), true);
  for (const invalid of ['4006381333932', '400638133393', '400638133393a', ' 4006381333931']) {
    assert.equal(isEan13(invalid), false);
    assert.equal(ean13Modules(invalid), undefined);
  }
  assert.equal(ean13Modules('0000000000000'), '101' + '0001101'.repeat(6) + '01010' + '1110010'.repeat(6) + '101');
});
