export async function printInvoiceElement(element) {
  if (!element) {
    window.print()
    return
  }

  const iframe = document.createElement("iframe")
  iframe.setAttribute("title", "SellerBot invoice print")
  iframe.style.position = "fixed"
  iframe.style.right = "0"
  iframe.style.bottom = "0"
  iframe.style.width = "0"
  iframe.style.height = "0"
  iframe.style.border = "0"
  iframe.style.visibility = "hidden"
  document.body.appendChild(iframe)

  const printDocument = iframe.contentWindow?.document
  if (!printDocument) {
    iframe.remove()
    window.print()
    return
  }

  printDocument.open()
  printDocument.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>SellerBot Invoice</title>
    <style>${collectCssText()}</style>
    <style>
      @page { size: A4; margin: 10mm; }
      html, body { background: #ffffff; margin: 0; padding: 0; }
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        font-family: Inter, "Hind Siliguri", Arial, sans-serif;
      }
      .print-shell { width: 100%; }
      .sellerbot-invoice-print {
        max-width: none !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        background: #ffffff !important;
      }
      .sellerbot-invoice-print table {
        border-collapse: collapse !important;
      }
    </style>
  </head>
  <body>
    <div class="print-shell">${element.outerHTML}</div>
  </body>
</html>`)
  printDocument.close()

  await waitForPrintDocument(iframe)
  iframe.contentWindow?.focus()
  iframe.contentWindow?.print()

  setTimeout(() => iframe.remove(), 1000)
}

function collectCssText() {
  const rules = []

  Array.from(document.styleSheets).forEach((sheet) => {
    try {
      Array.from(sheet.cssRules || []).forEach((rule) => rules.push(rule.cssText))
    } catch {
      const href = sheet.href
      if (href) rules.push(`@import url("${href}");`)
    }
  })

  return rules.join("\n")
}

function waitForPrintDocument(iframe) {
  return new Promise((resolve) => {
    const done = () => requestAnimationFrame(() => requestAnimationFrame(resolve))
    const doc = iframe.contentWindow?.document
    const pendingLinks = Array.from(doc?.querySelectorAll('link[rel="stylesheet"]') || [])

    if (pendingLinks.length === 0) {
      done()
      return
    }

    let remaining = pendingLinks.length
    const markLoaded = () => {
      remaining -= 1
      if (remaining <= 0) done()
    }

    pendingLinks.forEach((link) => {
      link.addEventListener("load", markLoaded, { once: true })
      link.addEventListener("error", markLoaded, { once: true })
    })
    setTimeout(done, 800)
  })
}