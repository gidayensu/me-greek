import database from "@/data/vocabulary.json"
import type {
  PartOfSpeech,
  VocabularyDatabase,
  VocabularySet,
  Word,
} from "./types"

const db = database as VocabularyDatabase

export const WORDS: readonly Word[] = db.words
export const SETS: readonly VocabularySet[] = db.sets
export const VOCABULARY_SOURCE = db.source
export const TOTAL_WORDS = WORDS.length
export const MAX_RANK = WORDS.reduce((max, w) => Math.max(max, w.rank), 0)

const BY_ID = new Map(WORDS.map((word) => [word.id, word]))
const BY_RANK = new Map(WORDS.map((word) => [word.rank, word]))
const BY_GREEK = new Map(WORDS.map((word) => [word.greek, word]))

export function getWord(id: string): Word | undefined {
  return BY_ID.get(id)
}

export function getWordByRank(rank: number): Word | undefined {
  return BY_RANK.get(rank)
}

/** Resolve a list of ids to words, dropping ids the current database no longer has. */
export function getWords(ids: readonly string[]): Word[] {
  return ids.map((id) => BY_ID.get(id)).filter((w): w is Word => Boolean(w))
}

/** Looks a word up by its exact headword spelling. */
export function getWordByGreek(greek: string): Word | undefined {
  return BY_GREEK.get(greek)
}

export function getSet(setId: string): VocabularySet | undefined {
  return SETS.find((set) => set.id === setId)
}

export function wordsInSet(setId: string): Word[] {
  const set = getSet(setId)
  if (!set) return []
  return wordsInRange(set.fromRank, set.toRank)
}

export function wordsInSets(setIds: readonly string[]): Word[] {
  const seen = new Set<string>()
  const out: Word[] = []
  for (const setId of setIds) {
    for (const word of wordsInSet(setId)) {
      if (seen.has(word.id)) continue
      seen.add(word.id)
      out.push(word)
    }
  }
  return out.sort((a, b) => a.rank - b.rank)
}

/** Inclusive on both ends. */
export function wordsInRange(fromRank: number, toRank: number): Word[] {
  const lo = Math.min(fromRank, toRank)
  const hi = Math.max(fromRank, toRank)
  return WORDS.filter((word) => word.rank >= lo && word.rank <= hi)
}

/** The set a rank belongs to, or undefined if it falls outside every set. */
export function setForRank(rank: number): VocabularySet | undefined {
  return SETS.find((set) => rank >= set.fromRank && rank <= set.toRank)
}

export type VocabularyFilter = {
  search?: string
  setIds?: readonly string[]
  partsOfSpeech?: readonly PartOfSpeech[]
}

/** Case-insensitive, accent-insensitive search across Greek, translit and gloss. */
export function normalizeGreek(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

export function filterWords(filter: VocabularyFilter): Word[] {
  const search = filter.search?.trim() ? normalizeGreek(filter.search) : null
  const setIds = filter.setIds?.length ? new Set(filter.setIds) : null
  const pos = filter.partsOfSpeech?.length
    ? new Set(filter.partsOfSpeech)
    : null

  return WORDS.filter((word) => {
    if (pos && !pos.has(word.pos)) return false
    if (setIds) {
      const set = setForRank(word.rank)
      if (!set || !setIds.has(set.id)) return false
    }
    if (search) {
      const haystack = normalizeGreek(
        `${word.greek} ${word.transliteration} ${word.gloss.join(" ")}`
      )
      if (!haystack.includes(search)) return false
    }
    return true
  })
}

/** The primary gloss, for compact UI where only one meaning fits. */
export function primaryGloss(word: Word): string {
  return word.gloss[0] ?? ""
}

export function formatGloss(word: Word): string {
  return word.gloss.join(", ")
}
