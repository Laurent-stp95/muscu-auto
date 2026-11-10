// Pont entre les modules ES de l'appli et les scripts classiques de common/ et data/. Ces fichiers ne peuvent pas être des
// modules : la page TV (Chromium 68, ES2018) charge shared.js et push-config.js par <script>, et le service worker charge
// files.js, data.js et push-config.js par importScripts. Chacun range donc ce qu'il définit sur l'objet global ; importés ici
// pour cet effet, ils sont réexportés sous forme de module. Marche aussi dans Node (tests).
import '../common/files.js';
import '../data/data.js';
import '../common/push-config.js';
import '../common/shared.js';

export const { FILES, EXOS, PUSH } = globalThis;
export const {
  beep, frenchVoices, frenchVoice, FRONT, JOINTS, COUNTER, COUNTER_EX, counterFor, CAM_EX, CAM_OFF, camKind, CAM_TEXT, BONES, poseModel,
  jointAngle, repCounter, tempoCoach, HANDS_HIGH, poseTracker, ICE, gathered,
} = globalThis.Shared;
