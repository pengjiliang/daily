// 价格显示工具
// - markupSpec：将规格中的 FOB 美元价格按 1.1 倍上浮显示（仅处理 $ 价格段，其余文字原样保留）
// - extractPrice：提取规格中的原始 FOB 价格（如 "$39.15-44.34"），无则返回 ''
// - stripPriceFromSpec：从规格文本中移除价格段，保留 MOQ 等其余产品信息
// - stripPriceFromDesc：从描述 HTML 中移除 FOB 价格段，保留 MOQ/认证等产品信息
export function markupSpec(spec, rate = 1.1) {
  if (!spec) return spec || ''
  return String(spec).replace(/(\$\s*)(\d+(?:\.\d+)?)(?:\s*[-–—]\s*(\d+(?:\.\d+)?))?/g, (_m, cur, a, b) => {
    const up = (n) => String(Math.round(Number(n) * rate * 100) / 100)
    return b ? `${cur}${up(a)}-${up(b)}` : `${cur}${up(a)}`
  })
}

// demarkupSpec：将 $ 价格按 1/1.1 还原（保存时把编辑器中显示的上浮价存回原价，避免重复上浮）
export function demarkupSpec(spec, rate = 1.1) {
  if (!spec) return spec || ''
  return String(spec).replace(/(\$\s*)(\d+(?:\.\d+)?)(?:\s*[-–—]\s*(\d+(?:\.\d+)?))?/g, (_m, cur, a, b) => {
    const down = (n) => String(Math.round((Number(n) / rate) * 100) / 100)
    return b ? `${cur}${down(a)}-${down(b)}` : `${cur}${down(a)}`
  })
}
export function extractPrice(spec) {
  const m = String(spec || '').match(/(\$\s*\d+(?:\.\d+)?(?:\s*[-–—]\s*\d+(?:\.\d+)?)?)/)
  return m ? m[1].trim() : ''
}

export function stripPriceFromSpec(spec) {
  if (!spec) return spec || ''
  return String(spec)
    .replace(/\$\s*\d+(?:\.\d+)?(?:\s*[-–—]\s*\d+(?:\.\d+)?)?/g, '')
    .replace(/\bFOB\b\s*/gi, '')
    .replace(/^\s*[·\-—–]\s*/, '')
    .replace(/\s*[·\-—–]\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function stripPriceFromDesc(html) {
  if (!html) return html || ''
  // 移除描述中的 "FOB 价格：$xx-yy" 段（分隔符可为全角空格、普通空格、·、< 标签或行尾），保留 MOQ/认证等产品信息
  return String(html).replace(/FOB\s*价格[：:]\s*(?:US\s*)?\$?\s*[\d.,\s\-–—]*(?:\s*\/\s*[^　<\n]*?)?[　·]*\s*(?=\s*(?:MOQ|认证)|[<\n]|$)/gi, '')
}
