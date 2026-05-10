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

  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((node) => node.outerHTML)
    .join("\n")

  printDocument.open()
  printDocument.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>SellerBot Invoice</title>
    ${styles}
    <style>
      @page { size: A4; margin: 10mm; }
      html, body { background: #ffffff; margin: 0; padding: 0; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .print-shell { width: 100%; }
      .sellerbot-invoice-print { max-width: none !important; width: 100% !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; }
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

function waitForPrintDocument(iframe) {
  return new Promise((resolve) => {
    const done = () => requestAnimationFrame(() => requestAnimationFrame(resolve))
    const doc = iframe.contentWindow?.document
    if (doc?.readyState === "complete") {
      done()
      return
    }
    iframe.onload = done
    setTimeout(done, 500)
  })
}
