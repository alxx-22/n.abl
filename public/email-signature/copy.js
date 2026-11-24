/* Copies the signature as rich HTML so it pastes with its layout and images. */
(function () {
  var btn = document.getElementById('copy')
  var status = document.getElementById('status')
  var sig = document.getElementById('sig')
  function say(t) { status.textContent = t }
  function selectSig() {
    var r = document.createRange(); r.selectNodeContents(sig)
    var s = window.getSelection(); s.removeAllRanges(); s.addRange(r)
  }
  btn.addEventListener('click', function () {
    var html = sig.innerHTML
    if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
      navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([sig.innerText], { type: 'text/plain' })
      })]).then(function () {
        say('Copied. Now paste it into your signature settings.')
      }, fallback)
    } else {
      fallback()
    }
  })
  function fallback() {
    selectSig()
    var ok = false
    try { ok = document.execCommand('copy') } catch (e) {}
    say(ok ? 'Copied. Now paste it into your signature settings.'
           : 'Selected. Press Ctrl+C (Cmd+C on Mac) to copy it.')
  }
})()
