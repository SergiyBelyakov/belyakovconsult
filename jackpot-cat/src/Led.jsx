// Семисегментний індикатор, як на автоматах 80-х: рубінові сегменти, вимкнені ледь видно.
const SEG = {
  a: 'M2 1H8L9 2 8 3H2L1 2Z', g: 'M2 8H8L9 9 8 10H2L1 9Z', d: 'M2 15H8L9 16 8 17H2L1 16Z',
  f: 'M1 2.5 2 3.5V7.5L1 8.5 0 7.5V3.5Z', b: 'M9 2.5 10 3.5V7.5L9 8.5 8 7.5V3.5Z',
  e: 'M1 9.5 2 10.5V14.5L1 15.5 0 14.5V10.5Z', c: 'M9 9.5 10 10.5V14.5L9 15.5 8 14.5V10.5Z',
};
const MAP = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '', d: 'bcdeg', U: 'bcdef', P: 'abefg', n: 'ceg', L: 'def', t: 'defg', E: 'adefg', S: 'afgcd' };

// value: число; text: напис замість числа (dUP, nULL, tESt); digits: мінімальна ширина
export function Led({ value, digits = 4, text, label, small, blink }) {
  const str = (text != null ? text : String(Math.max(0, Math.round(value || 0)))).padStart(digits, ' '), n = str.length;
  return (
    <span className={'jc-led' + (small ? ' small' : '') + (blink ? ' blink' : '')}>
      <svg viewBox={`0 0 ${n * 12 - 2} 18`} aria-hidden="true" focusable="false">
        {Array.from(str, (ch, i) => (
          <g key={i} transform={`translate(${i * 12} 0)`}>
            {Object.keys(SEG).map(s => <path key={s} d={SEG[s]} className={(MAP[ch] || '').includes(s) ? 'on' : ''} />)}
          </g>
        ))}
      </svg>
      <span className="sr-only">{label}: {text != null ? text.trim() : Math.round(value || 0)}</span>
    </span>
  );
}
