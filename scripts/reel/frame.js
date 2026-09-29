/* ============================================================
   Frame constants — shared by every show.
   ============================================================ */

/* The camera the site's scenes are framed through — same value as
   src/components/scenes/Scene.jsx. It was a literal in two places here
   and a name in neither, which is how the canvas ended up asking for a
   constant that did not exist. */
const SCENE_VIEWBOX = '320 146 800 608'

const STAGE_W = 1080, STAGE_H = 1920

/* Instagram's chrome, as margins. Nothing that carries meaning goes
   outside this: the profile row and caption stack over the bottom,
   the like/comment/share rail over the right. */
const SAFE = { top: 250, bottom: 480, left: 60, right: 120 }

/* Camera framings. Full-bleed horizontally in every case — a webcam
   inset with margins reads as a video call, not as a film. */
const FULL   = { x: 0, y: 0,   w: 1080, h: 1920 }
const HALF_B = { x: 0, y: 880, w: 1080, h: 1040 }
const HALF_T = { x: 0, y: 0,   w: 1080, h: 880  }

/* Where a scene sits when one is playing. 800x608 at 1000 wide is 760
   tall, which clears the bottom safe line by 60. */
const SCENE_RECT = { x: 40, y: 620, w: 1000, h: 760 }

const TRANS = 0.66          // seconds for the camera to travel between framings
