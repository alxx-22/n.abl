/* ============================================================
   SHOW — automation, shot as camera moves.

   Each section is a place on the canvas rather than a thing that
   appears. `cam` is the canvas point the frame centres on and the zoom
   it holds there; the player travels between them.

   Every position below is MEASURED off the built canvas, not guessed.
   A first pass set them by eye and each one was 240 to 260 canvas
   pixels out, which in a 9:16 frame is the difference between a
   composed shot and a clipped one.

   Three verbs and no more — across, down, and in. A camera that also
   rolls and orbits is a showreel; three reads as one operator who knows
   where they are going.
   ============================================================ */

/* Opens at half speed. Everything here is a camera move, and a camera
   move is exactly what benefits from being captured slow and sped back
   up: 60fps over twice the duration is 120fps of real sampling for the
   motion blur to blend. ?speed= still overrides. */
const SHOW_SPEED = 0.5

const SHOW = [
  /* Hold on the number long enough to be read and doubted. */
  { id: 'stat', dur: 3.4, cam: { x: 1050, y: 1495, z: 0.62 },
    say: 'Thirty-six billion pounds a year. That is what UK small businesses spend keeping up with the rules.' },

  /* ACROSS — to the second half of the same sentence. */
  { id: 'hours', dur: 3.0, cam: { x: 3150, y: 1462, z: 0.62 },
    say: 'Three hundred and seventy-nine million hours of it. The rules are not going anywhere. The typing is.' },

  /* DOWN — from the abstraction to a Tuesday. */
  { id: 'desk', dur: 3.0, cam: { x: 1050, y: 4763, z: 0.62 },
    say: 'Here is what that looks like on a Tuesday. An order arrives.' },

  /* DOWN again — the same order, being typed a second time. A push-in
     on either pane would overflow the frame: they are 1600 wide and 445
     tall, so the move between them is the shot. */
  { id: 'twice', dur: 2.8, cam: { x: 1050, y: 5411, z: 0.62 },
    say: 'And somebody types it into the second system.' },

  /* DOWN — to the thing that stops it. */
  { id: 'label', dur: 2.2, cam: { x: 1050, y: 7100, z: 0.62 },
    say: 'Set up once.' },

  { id: 'build', dur: 4.0, cam: { x: 1050, y: 8553, z: 0.60 }, scene: 'automation', from: 0.6,
    say: 'The steps that repeat between your systems, connected once and then left to run.' },

  /* IN — on the part that matters. */
  { id: 'runs', dur: 3.0, cam: { x: 1050, y: 8100, z: 0.95 }, scene: 'automation', from: 6.4,
    say: 'Nobody opens it again.' },

  /* ACROSS — off the work and onto the name. */
  { id: 'sign', dur: 3.6, cam: { x: 3150, y: 8500, z: 0.60 },
    say: "What's the job in your week that shouldn't need a person?" },
]
