import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/**
 * The expo join path. A stranger walking past a table will not type a code into
 * a phone, but they will point a camera at one — so the lobby carries a QR of
 * this host with the hab code already in the query string.
 */
export function JoinQr({ code }: { code: string }) {
  const [png, setPng] = useState<string | null>(null)
  const url = `${location.origin}/?hab=${code}`

  useEffect(() => {
    let live = true
    void QRCode.toDataURL(url, {
      margin: 1,
      width: 320,
      color: { dark: '#04121a', light: '#8ff4ff' },
    })
      .then((d) => {
        if (live) setPng(d)
      })
      // A missing QR is cosmetic — the four-letter code still works.
      .catch(() => {})
    return () => {
      live = false
    }
  }, [url])

  // A QR for localhost points the scanning phone at itself. Say so instead of
  // printing a code that looks right and goes nowhere.
  if (/^(localhost|127\.0\.0\.1|\[?::1\]?)$/.test(location.hostname)) {
    return (
      <div className="joinqr">
        <div className="tag">
          open this page from the tunnel URL
          <br />
          to get a code phones can scan
        </div>
      </div>
    )
  }

  if (!png) return null

  return (
    <div className="joinqr">
      <img src={png} alt={`Join hab ${code}`} width={132} height={132} />
      <div className="tag">
        point a phone at this
        <br />
        or type the code
      </div>
    </div>
  )
}
