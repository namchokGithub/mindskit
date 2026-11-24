/**
 * Curated Thai word readings (RTGS, without tone marks), one hyphen between syllables.
 *
 * Words found here, or fully covered by a sequence of these words, are treated as certain.
 * Every other Thai word falls back to `@pcampus/thai-romanization` and is flagged for review,
 * because that library still misreads common words (for example เป็น → "pe-on").
 */
const ENTRIES: Record<string, string> = {
  // Pronouns and people
  ฉัน: 'chan',
  เธอ: 'thoe',
  เรา: 'rao',
  เขา: 'khao',
  คุณ: 'khun',
  ผม: 'phom',
  ใคร: 'khrai',
  คน: 'khon',
  เพื่อน: 'phuean',
  แฟน: 'faen',
  ที่รัก: 'thi-rak',

  // Feelings
  รัก: 'rak',
  ความ: 'khwam',
  ความรัก: 'khwam-rak',
  ใจ: 'chai',
  หัวใจ: 'hua-chai',
  คิด: 'khit',
  ถึง: 'thueng',
  คิดถึง: 'khit-thueng',
  ฝัน: 'fan',
  หวัง: 'wang',
  ความหวัง: 'khwam-wang',
  ห่วง: 'huang',
  เหงา: 'ngao',
  เศร้า: 'sao',
  สุข: 'suk',
  ความสุข: 'khwam-suk',
  ทุกข์: 'thuk',
  รู้: 'ru',
  รู้สึก: 'ru-suek',
  ยิ้ม: 'yim',
  ร้องไห้: 'rong-hai',
  หัวเราะ: 'hua-ro',
  กอด: 'kot',
  จูบ: 'chup',
  ลืม: 'luem',
  จำ: 'cham',
  รอ: 'ro',
  เจ็บ: 'chep',
  เสียใจ: 'sia-chai',
  ดีใจ: 'di-chai',

  // Verbs
  เป็น: 'pen',
  อยู่: 'yu',
  ไป: 'pai',
  มา: 'ma',
  ได้: 'dai',
  ให้: 'hai',
  ทำ: 'tham',
  ทำให้: 'tham-hai',
  อยาก: 'yak',
  หา: 'ha',
  เจอ: 'choe',
  บอก: 'bok',
  พูด: 'phut',
  ฟัง: 'fang',
  เห็น: 'hen',
  ร้อง: 'rong',
  เพลง: 'phleng',
  กิน: 'kin',
  นอน: 'non',
  เดิน: 'doen',
  กลับ: 'klap',
  เคย: 'khoei',
  ขอ: 'kho',
  ขอบคุณ: 'khop-khun',

  // Function words and particles
  ไม่: 'mai',
  ไร: 'rai',
  อะไร: 'a-rai',
  ไม่เป็นไร: 'mai-pen-rai',
  ก็: 'ko',
  แล้ว: 'laeo',
  จะ: 'cha',
  และ: 'lae',
  กับ: 'kap',
  ที่: 'thi',
  ของ: 'khong',
  กัน: 'kan',
  ยัง: 'yang',
  อีก: 'ik',
  ทำไม: 'tham-mai',
  เพราะ: 'phro',
  นี้: 'ni',
  นั้น: 'nan',
  มาก: 'mak',
  จริง: 'ching',
  นะ: 'na',
  ครับ: 'khrap',
  ค่ะ: 'kha',
  คะ: 'kha',
  จ้ะ: 'cha',
  สวัสดี: 'sa-wat-di',
  เสมอ: 'sa-moe',
  ตลอด: 'ta-lot',
  ตลอดไป: 'ta-lot-pai',
  เดียว: 'diao',
  คนเดียว: 'khon-diao',

  // Time, nature, and things
  ทุก: 'thuk',
  วัน: 'wan',
  คืน: 'khuen',
  ครั้ง: 'khrang',
  ฟ้า: 'fa',
  ดาว: 'dao',
  เดือน: 'duean',
  น้ำ: 'nam',
  ตา: 'ta',
  น้ำตา: 'nam-ta',
  บอด: 'bot',
  ฝน: 'fon',
  ลม: 'lom',
  โลก: 'lok',
  ชีวิต: 'chi-wit',
  หัว: 'hua',
  มือ: 'mue',
  ทาง: 'thang',
  เส้นทาง: 'sen-thang',
  ใกล้: 'klai',
  ไกล: 'klai',
  ห่าง: 'hang',
  ใหม่: 'mai',
  เก่า: 'kao',
  สวย: 'suai',
  ดี: 'di',
  หนึ่ง: 'nueng',
  สอง: 'song',
  สาม: 'sam',
}

/** Thai word → reading syllables. */
export const KARAOKE_DICTIONARY: ReadonlyMap<string, readonly string[]> = new Map(
  Object.entries(ENTRIES).map(([thai, reading]) => [thai, reading.split('-')]),
)

const LONGEST_ENTRY = Math.max(...[...KARAOKE_DICTIONARY.keys()].map((word) => word.length))

/**
 * Splits a word into dictionary words that cover it exactly (fewest pieces wins).
 * Returns `[word]` for a direct entry and `null` when no exact cover exists.
 */
export function splitIntoDictionaryWords(word: string): string[] | null {
  if (!word) return null
  if (KARAOKE_DICTIONARY.has(word)) return [word]

  // best[i] = fewest pieces covering word.slice(0, i); prev[i] = start of the last piece.
  const best = new Array<number>(word.length + 1).fill(Number.POSITIVE_INFINITY)
  const prev = new Array<number>(word.length + 1).fill(-1)
  best[0] = 0
  for (let end = 1; end <= word.length; end += 1) {
    for (let start = Math.max(0, end - LONGEST_ENTRY); start < end; start += 1) {
      if (best[start] === Number.POSITIVE_INFINITY || !KARAOKE_DICTIONARY.has(word.slice(start, end))) continue
      if (best[start] + 1 < best[end]) {
        best[end] = best[start] + 1
        prev[end] = start
      }
    }
  }
  if (best[word.length] === Number.POSITIVE_INFINITY) return null

  const pieces: string[] = []
  for (let end = word.length; end > 0; end = prev[end]) pieces.unshift(word.slice(prev[end], end))
  return pieces
}

/** Reading syllables for a dictionary word or an exact sequence of dictionary words, else `null`. */
export function lookupDictionaryReading(word: string): string[] | null {
  const pieces = splitIntoDictionaryWords(word)
  return pieces ? pieces.flatMap((piece) => [...(KARAOKE_DICTIONARY.get(piece) ?? [])]) : null
}

/**
 * Regroups consecutive Thai words so that dictionary compounds become one word, whichever way the
 * browser's word segmenter split them: each word is first split into dictionary words where possible,
 * then the longest run of neighbours that forms a dictionary entry (e.g. ไม่ + เป็น + ไร) is merged.
 */
export function groupDictionaryWords(words: string[]): string[] {
  const pieces = words.flatMap((word) => splitIntoDictionaryWords(word) ?? [word])
  const grouped: string[] = []
  for (let start = 0; start < pieces.length; ) {
    let end = start + 1
    let combined = pieces[start]
    for (let next = start + 1; next < pieces.length && combined.length < LONGEST_ENTRY; next += 1) {
      combined += pieces[next]
      if (KARAOKE_DICTIONARY.has(combined)) end = next + 1
    }
    grouped.push(pieces.slice(start, end).join(''))
    start = end
  }
  return grouped
}
