// Comprehensive HTML Entity and Mojibake cleaner for RSS news feeds in Brazilian Portuguese

const NAMED_HTML_ENTITIES: Record<string, string> = {
  // Accented vowels and consonants
  atilde: 'ã',
  Atilde: 'Ã',
  otilde: 'õ',
  Otilde: 'Õ',
  ccedil: 'ç',
  Ccedil: 'Ç',
  aacute: 'á',
  Aacute: 'Á',
  eacute: 'é',
  Eacute: 'É',
  iacute: 'í',
  Iacute: 'Í',
  oacute: 'ó',
  Oacute: 'Ó',
  uacute: 'ú',
  Uacute: 'Ú',
  agrave: 'à',
  Agrave: 'À',
  egrave: 'è',
  Egrave: 'È',
  igrave: 'ì',
  Igrave: 'Ì',
  ograve: 'ò',
  Ograve: 'Ò',
  ugrave: 'ù',
  Ugrave: 'Ù',
  acirc: 'â',
  Acirc: 'Â',
  ecirc: 'ê',
  Ecirc: 'Ê',
  icirc: 'î',
  Icirc: 'Î',
  ocirc: 'ô',
  Ocirc: 'Ô',
  ucirc: 'û',
  Ucirc: 'Û',
  uuml: 'ü',
  Uuml: 'Ü',
  euml: 'ë',
  Euml: 'Ë',
  iuml: 'ï',
  Iuml: 'Ï',
  ouml: 'ö',
  Ouml: 'Ö',
  ntilde: 'ñ',
  Ntilde: 'Ñ',
  // Punctuation and quotes
  ordm: 'º',
  ordf: 'ª',
  deg: '°',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
  sbquo: '‚',
  bdquo: '„',
  laquo: '«',
  raquo: '»',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  bull: '•',
  middot: '·',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#39': "'",
  nbsp: ' ',
  copy: '©',
  reg: '®',
  trade: '™',
  sect: '§',
  para: '¶',
  dagger: '†',
  Dagger: '‡',
  cent: '¢',
  pound: '£',
  yen: '¥',
  euro: '€',
  plusmn: '±',
  sup1: '¹',
  sup2: '²',
  sup3: '³',
  frac14: '¼',
  frac12: '½',
  frac34: '¾',
  iquest: '¿',
  iexcl: '¡',
};

export function fixMojibake(str: string): string {
  if (!str) return '';
  // Check for common UTF-8 misinterpreted as ISO-8859-1 / Windows-1252 sequences
  if (!/Ã|Â|â€|â€“|â€”/.test(str)) {
    return str;
  }
  return str
    .replace(/Ã£/g, 'ã')
    .replace(/Ã§/g, 'ç')
    .replace(/Ã©/g, 'é')
    .replace(/Ã¡/g, 'á')
    .replace(/Ãª/g, 'ê')
    .replace(/Ã³/g, 'ó')
    .replace(/Ã­/g, 'í')
    .replace(/Ãº/g, 'ú')
    .replace(/Ãµ/g, 'õ')
    .replace(/Ã /g, 'à')
    .replace(/Ã‚/g, 'Â')
    .replace(/ÃŠ/g, 'Ê')
    .replace(/Ã”/g, 'Ô')
    .replace(/Ã‡/g, 'Ç')
    .replace(/Ã‰/g, 'É')
    .replace(/Ã/g, 'Á')
    .replace(/Ã“/g, 'Ó')
    .replace(/Ãš/g, 'Ú')
    .replace(/Ãƒ/g, 'Ã')
    .replace(/Âº/g, 'º')
    .replace(/Âª/g, 'ª')
    .replace(/Â°/g, '°')
    .replace(/â€œ/g, '“')
    .replace(/â€[ \x9d]/g, '”')
    .replace(/â€˜/g, '‘')
    .replace(/â€™/g, '’')
    .replace(/â€“/g, '–')
    .replace(/â€”/g, '—')
    .replace(/â€¦/g, '…')
    .replace(/Â\s/g, ' ');
}

export function cleanRssText(rawText?: string | null): string {
  if (!rawText) return '';

  let curr = String(rawText)
    // Extract CDATA contents
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    // Remove HTML comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Strip initial HTML tags
    .replace(/<[^>]+>/g, '');

  let prev = '';
  let loops = 0;

  // Multi-pass entity decoding to resolve nested/double encoded entities (e.g. &amp;atilde; -> &atilde; -> ã)
  while (curr !== prev && loops < 4) {
    prev = curr;
    loops++;
    curr = curr
      // Hexadecimal entities: &#x201C; &#xE3; &#xe1;
      .replace(/&#x([0-9a-fA-F]+);/gi, (_, hex) => {
        try {
          return String.fromCodePoint(parseInt(hex, 16));
        } catch {
          return _;
        }
      })
      // Decimal entities: &#227; &#8216;
      .replace(/&#(\d+);/g, (_, dec) => {
        try {
          return String.fromCodePoint(parseInt(dec, 10));
        } catch {
          return _;
        }
      })
      // Named HTML entities: &atilde; &ccedil; &quot; &apos;
      .replace(/&([a-zA-Z0-9#]+);/g, (match, name) => {
        return NAMED_HTML_ENTITIES[name] ?? NAMED_HTML_ENTITIES[name.toLowerCase()] ?? match;
      });
  }

  // Strip any HTML tags that might have emerged from decoded entities like &lt;b&gt;
  curr = curr.replace(/<[^>]+>/g, '');

  // Repair any UTF-8 as Latin-1 mojibake characters
  curr = fixMojibake(curr);

  // Normalize multiple spaces and non-breaking spaces
  return curr.replace(/[\u00A0\s]+/g, ' ').trim();
}
