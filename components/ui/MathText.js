import React, { useState, useMemo } from 'react';
import { Text, View, StyleSheet } from 'react-native';

// --- Lazy load: WebView yoksa uygulama çökmez ---
let _KaTeX = undefined;
function getKaTeX() {
  if (_KaTeX !== undefined) return _KaTeX;
  try {
    _KaTeX = require('react-native-katex').default;
  } catch {
    _KaTeX = null;
  }
  return _KaTeX;
}

// --- Unicode haritaları ---
const SUPERSCRIPTS = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ',
  'f': 'ᶠ', 'g': 'ᵍ', 'h': 'ʰ', 'i': 'ⁱ', 'j': 'ʲ',
  'k': 'ᵏ', 'l': 'ˡ', 'm': 'ᵐ', 'n': 'ⁿ', 'o': 'ᵒ',
  'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ', 't': 'ᵗ', 'u': 'ᵘ',
  'v': 'ᵛ', 'w': 'ʷ', 'x': 'ˣ', 'y': 'ʸ', 'z': 'ᶻ',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
};
const SUBSCRIPTS = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ',
  'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ',
  'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ',
  'v': 'ᵥ', 'x': 'ₓ',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
};
const LATEX_SYMBOLS = {
  '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
  '\\epsilon': 'ε', '\\varepsilon': 'ε', '\\zeta': 'ζ', '\\eta': 'η',
  '\\theta': 'θ', '\\vartheta': 'ϑ', '\\iota': 'ι', '\\kappa': 'κ',
  '\\lambda': 'λ', '\\mu': 'μ', '\\nu': 'ν', '\\xi': 'ξ',
  '\\pi': 'π', '\\rho': 'ρ', '\\sigma': 'σ', '\\tau': 'τ',
  '\\upsilon': 'υ', '\\phi': 'φ', '\\varphi': 'φ', '\\chi': 'χ',
  '\\psi': 'ψ', '\\omega': 'ω',
  '\\Gamma': 'Γ', '\\Delta': 'Δ', '\\Theta': 'Θ', '\\Lambda': 'Λ',
  '\\Xi': 'Ξ', '\\Pi': 'Π', '\\Sigma': 'Σ', '\\Upsilon': 'Υ',
  '\\Phi': 'Φ', '\\Psi': 'Ψ', '\\Omega': 'Ω',
  '\\infty': '∞', '\\partial': '∂', '\\nabla': '∇',
  '\\int': '∫', '\\iint': '∬', '\\iiint': '∭', '\\oint': '∮',
  '\\sum': '∑', '\\prod': '∏',
  '\\cdot': '·', '\\times': '×', '\\div': '÷', '\\pm': '±', '\\mp': '∓',
  '\\circ': '∘', '\\bullet': '•', '\\star': '⋆',
  '\\leq': '≤', '\\geq': '≥', '\\neq': '≠', '\\equiv': '≡',
  '\\sim': '∼', '\\cong': '≅', '\\approx': '≈', '\\propto': '∝',
  '\\ll': '≪', '\\gg': '≫',
  '\\in': '∈', '\\notin': '∉', '\\subset': '⊂', '\\supset': '⊃',
  '\\subseteq': '⊆', '\\supseteq': '⊇', '\\cup': '∪', '\\cap': '∩',
  '\\bigcup': '⋃', '\\bigcap': '⋂', '\\emptyset': '∅', '\\varnothing': '∅',
  '\\forall': '∀', '\\exists': '∃', '\\nexists': '∄',
  '\\neg': '¬', '\\land': '∧', '\\lor': '∨',
  '\\angle': '∠', '\\perp': '⊥', '\\parallel': '∥', '\\triangle': '△',
  '\\to': '→', '\\rightarrow': '→', '\\leftarrow': '←',
  '\\Rightarrow': '⇒', '\\Leftarrow': '⇐', '\\Leftrightarrow': '⇔',
  '\\implies': '⇒', '\\iff': '⇔',
  '\\lim': 'lim', '\\sin': 'sin', '\\cos': 'cos', '\\tan': 'tan',
  '\\cot': 'cot', '\\sec': 'sec', '\\csc': 'csc',
  '\\log': 'log', '\\ln': 'ln', '\\exp': 'exp',
  '\\det': 'det', '\\min': 'min', '\\max': 'max',
  '\\sup': 'sup', '\\inf': 'inf', '\\mod': 'mod', '\\gcd': 'gcd',
};

// Uzun komutlar önce eşleşsin
const SORTED_SYMBOL_KEYS = Object.keys(LATEX_SYMBOLS).sort((a, b) => b.length - a.length);

// --- Brace parser ---
function extractBrace(str, pos) {
  if (pos >= str.length || str[pos] !== '{') return null;
  let depth = 0;
  for (let i = pos; i < str.length; i++) {
    if (str[i] === '{') depth++;
    else if (str[i] === '}') {
      depth--;
      if (depth === 0) return { content: str.slice(pos + 1, i), end: i };
    }
  }
  return null;
}

// --- Segment parser: \frac ve \binom'u ayırır ---
function parseSegments(text) {
  if (!text) return [];
  const segs = [];
  let rest = text;

  while (rest.length > 0) {
    const fi = rest.indexOf('\\frac');
    const bi = rest.indexOf('\\binom');
    let idx = -1, cmd = '', cmdLen = 0;

    if (fi !== -1 && (bi === -1 || fi < bi)) { idx = fi; cmd = 'frac'; cmdLen = 5; }
    else if (bi !== -1) { idx = bi; cmd = 'binom'; cmdLen = 6; }

    if (idx === -1) { segs.push({ t: 'txt', v: rest }); break; }

    if (idx > 0) segs.push({ t: 'txt', v: rest.slice(0, idx) });

    let p = idx + cmdLen;
    while (p < rest.length && rest[p] === ' ') p++;
    const first = extractBrace(rest, p);
    if (!first) { segs.push({ t: 'txt', v: rest.slice(idx) }); break; }

    p = first.end + 1;
    while (p < rest.length && rest[p] === ' ') p++;
    const second = extractBrace(rest, p);
    if (!second) { segs.push({ t: 'txt', v: rest.slice(idx) }); break; }

    segs.push({ t: cmd, num: first.content, den: second.content });
    rest = rest.slice(second.end + 1);
  }
  return segs;
}

// --- Unicode dönüştürücü (Text-only fallback) ---
function toUnicode(raw) {
  if (!raw) return '';
  let s = String(raw);

  s = s.replace(/\\frac\s*\{([^}]*)\}\s*\{([^}]*)\}/g, '($1)/($2)');
  s = s.replace(/\\sqrt\[([^\]]+)\]\s*\{([^}]*)\}/g, (_, n, x) => {
    const sup = n.split('').map(c => SUPERSCRIPTS[c] ?? c).join('');
    return sup + '√(' + x + ')';
  });
  s = s.replace(/\\sqrt\{([^}]*)\}/g, '√($1)');
  s = s.replace(/\\binom\s*\{([^}]*)\}\s*\{([^}]*)\}/g, 'C($1,$2)');
  s = s.replace(/\\overline\{([^}]*)\}/g, '$1\u0305');
  s = s.replace(/\\underline\{([^}]*)\}/g, '$1\u0332');
  s = s.replace(/\\hat\{([^}]*)\}/g, '$1\u0302');
  s = s.replace(/\\vec\{([^}]*)\}/g, '$1\u20D7');
  s = s.replace(/\\bar\{([^}]*)\}/g, '$1\u0304');
  s = s.replace(/\\dot\{([^}]*)\}/g, '$1\u0307');
  s = s.replace(/\\ddot\{([^}]*)\}/g, '$1\u0308');
  s = s.replace(/\\tilde\{([^}]*)\}/g, '$1\u0303');
  s = s.replace(/\\(?:text|mathrm|mathbf|mathbb|mathcal)\{([^}]*)\}/g, '$1');
  s = s.replace(/\\(?:left|right)\s*/g, '');
  s = s.replace(/\\(?:begin|end)\{[^}]*\}/g, '');
  s = s.replace(/\\(?:overbrace|underbrace)\{([^}]*)\}/g, '$1');

  for (const cmd of SORTED_SYMBOL_KEYS) {
    const escaped = cmd.replace(/\\/g, '\\\\');
    s = s.replace(new RegExp(escaped + '(?![a-zA-Z])', 'g'), LATEX_SYMBOLS[cmd]);
  }

  s = s.replace(/_\{([^}]*)\}/g, (_, inner) =>
    inner.split('').map(c => SUBSCRIPTS[c] ?? c).join('')
  );
  s = s.replace(/_([a-zA-Z0-9])/g, (_, c) => SUBSCRIPTS[c] ?? c);
  s = s.replace(/\^\{([^}]*)\}/g, (_, inner) =>
    inner.split('').map(c => SUPERSCRIPTS[c] ?? c).join('')
  );
  s = s.replace(/\^([a-zA-Z0-9])/g, (_, c) => SUPERSCRIPTS[c] ?? c);

  s = s.replace(/[{}]/g, '');
  s = s.replace(/\\[a-zA-Z]+/g, '');
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s;
}

// --- Native View render (kesirler pay/payda, binom parantezli) ---
function renderRich(text, style, depth = 0) {
  const segs = parseSegments(text);
  const flat = StyleSheet.flatten(style) || {};
  const color = flat.color || '#000';
  const fontSize = flat.fontSize || 16;
  const textAlign = flat.textAlign || 'left';

  if (segs.every(s => s.t === 'txt')) {
    return <Text style={style}>{toUnicode(text)}</Text>;
  }

  const jc = textAlign === 'center' ? 'center' : textAlign === 'right' ? 'flex-end' : 'flex-start';

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: jc }}>
      {segs.map((seg, i) => {
        if (seg.t === 'txt') {
          const u = toUnicode(seg.v);
          if (!u) return null;
          return <Text key={i} style={style}>{u}</Text>;
        }

        const innerSize = Math.max(fontSize * (depth > 0 ? 0.72 : 0.8), 10);
        const innerStyle = { ...flat, fontSize: innerSize, textAlign: 'center' };

        if (seg.t === 'frac') {
          return (
            <View key={i} style={richStyles.fracContainer}>
              <View style={richStyles.fracCell}>
                {renderRich(seg.num, innerStyle, depth + 1)}
              </View>
              <View style={[richStyles.fracLine, { backgroundColor: color }]} />
              <View style={richStyles.fracCell}>
                {renderRich(seg.den, innerStyle, depth + 1)}
              </View>
            </View>
          );
        }

        if (seg.t === 'binom') {
          const parenSize = fontSize * (depth > 0 ? 1.2 : 1.6);
          return (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[style, { fontSize: parenSize }]}>(</Text>
              <View style={richStyles.fracContainer}>
                <View style={richStyles.fracCell}>
                  {renderRich(seg.num, innerStyle, depth + 1)}
                </View>
                <View style={richStyles.fracCell}>
                  {renderRich(seg.den, innerStyle, depth + 1)}
                </View>
              </View>
              <Text style={[style, { fontSize: parenSize }]}>)</Text>
            </View>
          );
        }
        return null;
      })}
    </View>
  );
}

const richStyles = StyleSheet.create({
  fracContainer: {
    alignItems: 'center',
    marginHorizontal: 3,
  },
  fracCell: {
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  fracLine: {
    height: StyleSheet.hairlineWidth * 2.5,
    width: '100%',
    minWidth: 20,
  },
});

// --- LaTeX tespiti ---
const LATEX_RE = /\\(?:frac|sqrt|sum|prod|int|iint|iiint|oint|lim|binom|begin|end|left|right|text|mathrm|mathbf|mathbb|mathcal|overline|underline|overbrace|underbrace|hat|bar|vec|dot|ddot|tilde|cdot|times|div|pm|mp|circ|bullet|star|leq|geq|neq|equiv|sim|cong|approx|propto|ll|gg|in|notin|subset|supset|subseteq|supseteq|cup|cap|bigcup|bigcap|emptyset|varnothing|infty|partial|nabla|forall|exists|nexists|neg|land|lor|angle|perp|parallel|triangle|to|rightarrow|leftarrow|Rightarrow|Leftarrow|Leftrightarrow|implies|iff|sin|cos|tan|cot|sec|csc|log|ln|exp|det|min|max|sup|inf|mod|gcd|alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|varphi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega)(?![a-zA-Z])/;
const HAS_FRAC_RE = /\\(?:frac|binom)/;

function isLatex(text) {
  return !!text && LATEX_RE.test(text);
}

// WebView CSS px → RN dp çarpanı
const KATEX_FONT_SCALE = 4.4;

// --- Component ---
export default function MathText({
  value,
  style,
  numberOfLines,
  ellipsizeMode,
  displayMode = false,
  forceText = false,
  ...rest
}) {
  const [katexFailed, setKatexFailed] = useState(false);

  const hasLatex = useMemo(() => isLatex(value), [value]);
  const hasFracs = useMemo(() => !!value && HAS_FRAC_RE.test(value), [value]);
  const unicode  = useMemo(() => toUnicode(value), [value]);

  const KaTeX = getKaTeX();
  const canUseKatex = hasLatex && KaTeX && !katexFailed && !numberOfLines && !forceText;

  // Native View rendering: pay/payda kesirler, binom vb.
  if (!canUseKatex && forceText && hasLatex && hasFracs && !numberOfLines) {
    return renderRich(value, style);
  }

  // Düz unicode text
  if (!canUseKatex) {
    return (
      <Text
        style={style}
        numberOfLines={numberOfLines}
        ellipsizeMode={ellipsizeMode}
        {...rest}
      >
        {unicode}
      </Text>
    );
  }

  // KaTeX WebView (CardDetailView vb.)
  const flatStyle = StyleSheet.flatten(style) || {};
  const color     = flatStyle.color || '#000';
  const fontSize  = flatStyle.fontSize || 16;
  const cssFontSize = Math.round(fontSize * KATEX_FONT_SCALE);

  const inlineStyle = `
    html, body { margin: 0; padding: 0; background: transparent; }
    .katex { font-size: ${cssFontSize}px !important; color: ${color}; }
    .katex-display { margin: 0; padding: 0; }
    .katex-display > .katex { text-align: left; }
  `;

  return (
    <View style={{ minHeight: fontSize * 2.5 }}>
      <KaTeX
        expression={value}
        displayMode={displayMode}
        style={{ backgroundColor: 'transparent', flex: 1 }}
        inlineStyle={inlineStyle}
        onError={() => setKatexFailed(true)}
      />
    </View>
  );
}
