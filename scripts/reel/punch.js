/* ============================================================
   PUNCH — the typewriter opener and the receding word.

   Two moves lifted from the reference, and one deliberately not.

   The typewriter: characters land one at a time behind a blinking
   caret, and the sentence turns colour partway through so the claim
   separates itself from the setup without a second line of type.

   The receding word: it starts larger than the frame and shrinks the
   whole time it is on screen, travelling away from the viewer rather
   than arriving at them. That direction is the whole effect — a word
   that scales up reads as emphasis, a word that scales down reads as
   speed.

   Not lifted: the background. The reference runs saturated light
   tunnels behind its words. A radial starburst is decorative
   maximalism whatever colour it is painted, and this studio's whole
   position is the opposite of that — modern, minimal, anti-corporate.
   An amber firework was still a firework. The word now recedes on the
   plain ground, which is both on-brand and one fewer canvas repainting
   itself sixty times a second.
   ============================================================ */

/* ------------------------------------------------------------------
   Typewriter. `head` is the sentence; `turn` is the character index
   where it changes colour.
   ------------------------------------------------------------------ */
function drawTypewriter(el, lt, s) {
  const chars = s.head.length
  const start = s.at ?? 0.25
  const rate = s.rate ?? 0.042            // seconds per character
  const n = clamp(Math.floor((lt - start) / rate), 0, chars)

  const turn = s.turn ?? chars
  const lead = s.head.slice(0, Math.min(n, turn))
  const rest = n > turn ? s.head.slice(turn, n) : ''

  /* Only rewritten when the count changes: this runs every frame. */
  if (el.dataset.n !== String(n)) {
    el.dataset.n = String(n)
    el.querySelector('.twLead').textContent = lead
    el.querySelector('.twRest').textContent = rest
  }

  /* The caret blinks only once typing has stopped — a caret that
     blinks mid-word looks like a dropped frame. */
  const done = n >= chars
  const caret = el.querySelector('.twCaret')
  caret.style.opacity = done
    ? (Math.floor((lt - start - chars * rate) * 2) % 2 ? '0' : '1')
    : '1'
}

/* ------------------------------------------------------------------
   The receding word. Starts past the frame edge and shrinks the whole
   time, so the shot reads as travel rather than as emphasis.
   ------------------------------------------------------------------ */
function drawWord(el, lt, s) {
  const p = seg(lt, 0, s.dur, LINEAR)
  const scale = lerp(s.from ?? 2.35, s.to ?? 0.72, EASE_IO(p))
  const inP = seg(lt, 0, 0.26, EASE_OUT)
  const outP = seg(lt, s.dur - 0.42, s.dur, EASE)

  el.style.transform = `scale(${scale.toFixed(4)})`
  el.style.opacity = ((inP - outP) * lerp(1, 0.55, p)).toFixed(3)
  /* Letter-spacing opens as it recedes, which is what stops a shrinking
     word from reading as a word that is simply getting smaller. */
  el.style.letterSpacing = `${lerp(-0.02, 0.14, p).toFixed(4)}em`
}
