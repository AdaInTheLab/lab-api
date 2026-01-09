export function expandMascotBlocks(md: string): string {
    // :::carmel ... :::
    return md.replace(
        /(^|\n):::carmel\s*\n([\s\S]*?)\n:::(?=\n|$)/g,
        (_m, lead, body) => {
            const text = body.trim();
            // Escape HTML so users can't inject tags inside the block
            const safe = text
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");

            return `${lead}<div class="carmel-callout">
  <div class="carmel-callout-title">😼 <strong>Carmel calls this:</strong></div>
  <div class="carmel-callout-body">“${safe}”</div>
</div>`;
        }
    );
}
