import { SPEECH_LANGUAGE } from "@/lib/constants"

/**
 * Browser speech synthesis for Greek headwords.
 *
 * Systems almost never ship a Koine voice, so this uses the modern Greek
 * locale: it is a memory aid for recognising a word by ear, not a claim
 * about first-century pronunciation.
 */

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window
}

export function speakGreek(text: string, rate = 1): void {
  if (!canSpeak()) return
  // Cancel first: without it, rapid replays queue up and overlap.
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = SPEECH_LANGUAGE
  utterance.rate = rate
  window.speechSynthesis.speak(utterance)
}

export function stopSpeaking(): void {
  if (!canSpeak()) return
  window.speechSynthesis.cancel()
}
