// --- Coach vocal ---
// Annonces lues par la voix française de l'appareil (réglable dans Réglages). Quand l'écran projeté est connecté, c'est lui qui parle.

import { frenchVoice } from './common.js';
import { state } from './store.js';
import { micOpen, saysCommand, mic, hush } from './voice.js';
import { projected } from './screen.js';

export const voiceOn = () => state.config?.voice !== false;
export function speak(text, here = false) {
  const synth = window.speechSynthesis;
  if (!text || !synth || !voiceOn() || (projected() && !here)) return;
  if (micOpen() && saysCommand(text)) return; // ne jamais se valider soi-même
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'fr-FR';
  u.voice = frenchVoice(synth, state.config?.voiceName);
  u.onend = () => { mic.spokeAt = Date.now(); };
  mic.spokeAt = Date.now();
  hush(text);
  synth.cancel();
  synth.speak(u);
}
