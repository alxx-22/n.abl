/* ============================================================
   SHOW — web, shot on one horizontal track.

   Automation walked a staircase; data pulled back through a single
   object. This one only ever moves RIGHT, or IN. Five cells in a row,
   two push-ins, no other verb — which is the same shape as the thing
   being sold, because a booking is a sequence and not a collection.

   Every position below is MEASURED off the built canvas. The two
   push-ins are read from the rendered DOM rather than estimated from
   the layout constants: the enquiry row's box, and the booking panel's
   position inside an SVG that letterboxes to the cell's width.
   ============================================================ */

const SHOW_SPEED = 0.5

const SHOW = [
  /* The number, held long enough to be read and doubted. */
  { id: 'stat', dur: 3.4, cell: 'num', cam: { x: 1050, y: 1700, z: 0.60 },
    say: 'Seventy-eight per cent of UK businesses now have a website.' },

  /* ACROSS — to what it was, which is the actual point. */
  { id: 'turn', dur: 3.2, cell: 'turn', cam: { x: 3150, y: 1700, z: 0.60 },
    say: 'Two years ago it was sixty-eight. Everybody caught up, so having one stopped being the difference.' },

  /* ACROSS — off the abstraction and onto one evening. */
  { id: 'night', dur: 3.0, cell: 'night', cam: { x: 5250, y: 1700, z: 0.60 },
    say: "So here's Thursday night. Five people wanted something." },

  /* IN — on the times, not the messages.

     Measured: the rows are 1500 wide, so there is no zoom that pushes
     in AND keeps one whole — 1080/1500 is 0.72, which is not a push-in.
     Crop deliberately instead, and crop on the axis that carries the
     beat: the frame holds the timestamps at screen x145-523 and lets
     the message bars run out of shot to the right.

     2.27 puts two rows (canvas 1009-1533) across the 1190px Instagram
     leaves clear, with a third entering from the bottom. y1392 is not
     the centre of those two — it is the lowest value that still puts
     the frame's top edge past canvas 969, where the kick ends, so the
     label is cleanly gone rather than sliced through. A first pass put
     it at 1545 on a stale reading of where the kick sat, and left 88px
     of a cut-in-half label at the top of the frame: the same mistake
     that had to be measured out of the automation cut. */
  { id: 'late', dur: 2.8, cell: 'night', crop: true, cam: { x: 4662, y: 1392, z: 2.27 },
    say: 'The form sends you an email. You read it in the morning.' },

  /* ACROSS and OUT together — one move, not two. Scene from 0.15 covers
     the cursor leaving home, the slot being picked and the list choice.
     Given longer to travel because it is also unwinding a 3x zoom. */
  { id: 'build', dur: 4.3, cell: 'fix', travel: 1.5, cam: { x: 7350, y: 1700, z: 0.60 },
    scene: 'web', from: 0.15,
    say: 'Or the site takes the booking. They pick a slot, they pay, it lands in your calendar.' },

  /* IN — on the panel, through the two fields and the confirm.

     Measured through the SVG rather than guessed at: the scene's viewBox
     is 320 146 800 608 and it letterboxes to the cell's 1500 width, so
     one scene unit is 1.875 canvas px with the origin at canvas
     5950,989.25. That puts the panel (scene 646,468 + 280x206) at
     canvas x7161-7686 by y1867-2253, the chosen slot at 7313-7534 by
     y1713-1826, and the confirmation mark at 7300,1874.

     1.70 rather than a rounder number because the panel is 525 canvas
     px wide and the band Instagram leaves clear is 900 screen px:
     525 x 1.70 is 893, and anything past 1.714 puts the panel's edges
     under the like and share rail. Centred on that band, the shot holds
     the chosen slot from screen y385, the tether, the panel, and the
     confirm button down to y1303.

     from 4.45 picks up exactly where `build` left off; the first field
     takes focus at 4.50. dur 3.9 runs to scene 8.35, because the tick
     draws 7.46-8.02 and a beat that ends before 8.02 cuts the
     confirmation off half-finished. */
  { id: 'booked', dur: 3.9, cell: 'fix', crop: true, cam: { x: 7441, y: 2051, z: 1.70 },
    scene: 'web', from: 4.45,
    say: 'Confirmed at nine forty-one. Nobody was asked.' },

  /* ACROSS — off the work and onto the name. */
  { id: 'sign', dur: 3.6, cell: 'sign', travel: 1.4, cam: { x: 9450, y: 1700, z: 0.60 },
    say: "What does your website do when nobody's watching it?" },
]
