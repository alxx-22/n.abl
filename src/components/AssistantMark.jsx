/* The assistant's mark, on the launcher of the site and of the portal.

   The brand's lit ground in a drop of glass: its three lights, ember, amber
   and ice, glow inside a small dark sphere with a highlight on its curve,
   and the spark of an answer sits at the centre. It replaces a flat amber
   sparkle, which said "AI" in anyone's colours; this one can only be n.abl's.

   It holds still unless something is happening: the lights turn once when
   the launcher arrives, and turn for as long as the pointer is on it
   (components.css, THE ASSISTANT'S MARK). */
export default function AssistantMark() {
  return (
    <span className="mark-orb" aria-hidden="true">
      <i className="mark-orb__spin"><i className="mark-orb__lights" /></i>
      <svg className="mark-orb__spark" viewBox="0 0 24 24" focusable="false">
        <path d="M12 1C13.7 10.3 13.7 10.3 23 12C13.7 13.7 13.7 13.7 12 23C10.3 13.7 10.3 13.7 1 12C10.3 10.3 10.3 10.3 12 1Z" />
      </svg>
    </span>
  )
}
