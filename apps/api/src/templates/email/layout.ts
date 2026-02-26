export function wrapInLayout(bodyMjml: string, orgName: string): string {
  return `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="Arial, sans-serif" />
      <mj-text font-size="14px" color="#333333" line-height="1.5" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#ffffff" padding="20px">
      <mj-column>
        <mj-text font-size="20px" font-weight="bold" align="center">
          ${escapeHtml(orgName)}
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="20px 30px">
      <mj-column>
        ${bodyMjml}
      </mj-column>
    </mj-section>
    <mj-section padding="10px 30px">
      <mj-column>
        <mj-text font-size="12px" color="#999999" align="center">
          Sent by ${escapeHtml(orgName)} via Colophony
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
