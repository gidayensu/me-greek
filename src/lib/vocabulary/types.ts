export type PartOfSpeech =
  | "article"
  | "conjunction"
  | "pronoun"
  | "preposition"
  | "verb"
  | "noun"
  | "adjective"
  | "adverb"
  | "particle"
  | "numeral"
  | "name"

export type Gender = "masculine" | "feminine" | "neuter"

export type WordExample = {
  reference: string
  greek: string
  english: string
  /**
   * The headword exactly as it is inflected in `greek`. Greek inflection
   * changes the stem (ἀγαπάω appears as ἠγάπησεν), so the form to look for
   * is recorded rather than derived.
   */
  targetForm?: string
}

/** One entry of the shared, bundled vocabulary database. Never user data. */
export type Word = {
  id: string
  greek: string
  transliteration: string
  gloss: string[]
  pos: PartOfSpeech
  /** 1-based position in the New Testament frequency ordering. */
  rank: number
  /** Approximate occurrences in the Greek New Testament. */
  frequency: number
  gender?: Gender
  note?: string
  example?: WordExample
}

/** A named, contiguous range of ranks — the default unit of study. */
export type VocabularySet = {
  id: string
  index: number
  title: string
  fromRank: number
  toRank: number
}

export type VocabularyDatabase = {
  schemaVersion: number
  source: string
  sets: VocabularySet[]
  words: Word[]
}
