/* ============================================================
   SHOW — data, shot as one object at four distances.

   The automation reel walked down a column of cells. This one never
   leaves the same object: it opens inside a single spreadsheet cell,
   where the number looks fine, and pulls back until you can see how
   many are not. Nothing is wrong with any figure you are looking at.
   The problem is only visible from further away, which is the argument
   for the service stated as a camera move.

   Positions are measured off the built grid, not guessed.
   ============================================================ */

const SHOW_SPEED = 0.5

const SHOW = [
  /* Inside one cell. Deliberately not one of the marked ones. */
  { id: 'cell', dur: 3.0, cell: 'sheet', cam: { x: 1865, y: 1551, z: 3.40 },
    say: 'This number is fine.' },

  /* OUT — a row of them. Still fine. */
  { id: 'row', dur: 2.6, cell: 'sheet', cam: { x: 1270, y: 1551, z: 0.95 },
    say: 'So is this one. And this one.' },

  /* OUT — the sheet, and the ones that are not. */
  { id: 'sheet', dur: 4.2, cell: 'sheet', reveal: true, cam: { x: 1270, y: 2920, z: 0.42 },
    say: 'Pull back far enough and you can see the ones that are not.' },

  /* DOWN — the finding. */
  { id: 'stat', dur: 3.8, cell: 'stat', cam: { x: 1150, y: 6600, z: 0.58 },
    say: 'Ninety-four per cent of business spreadsheets contain errors. About one cell in twenty.' },

  /* ACROSS — what we do about it. */
  { id: 'fix', dur: 4.2, cell: 'fix', cam: { x: 3200, y: 6600, z: 0.58 }, scene: 'data', from: 1.2,
    say: 'The data cleaned up first. Then reporting you can actually decide from.' },

  /* IN — on the answer rather than the rows. */
  { id: 'answer', dur: 3.0, cell: 'fix', cam: { x: 3200, y: 7150, z: 0.86 }, scene: 'data', from: 7.4,
    say: 'One set of numbers, current every morning.' },

  /* DOWN and ACROSS — the name. */
  { id: 'sign', dur: 3.6, cell: 'sign', cam: { x: 1150, y: 9360, z: 0.58 },
    say: 'Which of your numbers has nobody checked?' },
]
