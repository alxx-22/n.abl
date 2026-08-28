/* ============================================================
   THE SIX SCENES

   One short film per capability, each a miniature of something we
   actually build. They share a grammar — human action, system
   response, useful outcome — and deliberately not a subject: the
   automation pipeline builds by addition, the software panel builds
   by division, so two scenes that could have looked alike do not.

   Each module exports { make, bind, render, dur }. make() returns the
   SVG as a string, bind() collects the nodes render() will move, and
   render(els, t) places every one of them for time t in seconds. No
   scene holds state of its own: given the same t it draws the same
   frame, which is what lets one loop drive all of them and lets a
   still be taken at any moment for reduced motion.
   ============================================================ */
export { default as automation } from './automation.js'
export { default as data } from './data.js'
export { default as software } from './software.js'
export { default as web } from './web.js'
export { default as training } from './training.js'
export { default as ai } from './ai.js'
