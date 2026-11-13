/** Validate the GS1 EAN-13 check digit, preserving leading zeroes. */
export function isEan13(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false;
  const sum = [...value.slice(0, 12)].reduce((total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1), 0);
  return (10 - sum % 10) % 10 === Number(value[12]);
}

/** Return the 95 EAN-13 modules, or undefined for an invalid identifier. */
export function ean13Modules(value: string): string | undefined {
  if (!isEan13(value)) return undefined;
  const l = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
  const g = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
  const r = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
  const parity = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'][Number(value[0])];
  return '101' + [...value.slice(1, 7)].map((d, i) => (parity[i] === 'L' ? l : g)[Number(d)]).join('') + '01010' + [...value.slice(7)].map(d => r[Number(d)]).join('') + '101';
}
