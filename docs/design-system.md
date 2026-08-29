# Design System — gilmar-sales.github.io

Referência visual do blog. Fonte de verdade: `css/base.css`, `css/tokens.css`, `css/screens.css`, `css/tables.css`, `css/mobile.css`.

---

## Tipografia

### Font stacks

| Variável | Stack |
|---|---|
| `--font-serif` | Source Serif 4, Source Serif Pro, Iowan Old Style, Georgia, serif |
| `--font-sans` | Inter Tight, IBM Plex Sans, system-ui, sans-serif |
| `--font-mono` | JetBrains Mono, IBM Plex Mono, ui-monospace, Menlo, monospace |

Carregadas via Google Fonts no layout `default.html`.

### Base

- `body`: serif, 17px, line-height 1.7, cor `--ink`, fundo `--paper`
- Font features: `"onum"`, `"kern"`, `"liga"`

### Classes utilitárias (`css/tokens.css`)

| Classe | Fonte | Tamanho | Uso |
|---|---|---|---|
| `.eyebrow` | mono | 11px | Label superior uppercase, `--ink-3` |
| `.h-display` | serif | clamp(36px, 4.2vw, 58px) | Títulos hero |
| `.h-title` | serif | 24px | Títulos de seção |
| `.h-section` | sans | 13px | Subtítulo uppercase |
| `.body` | — | 16px / 1.7 | Texto corrido |
| `.mono-label` | mono | 11px | Labels técnicos |
| `.prose` | serif | `--prose-size` / `--prose-lh` | Artigos longos |

---

## Paleta

### Superfícies e texto

| Variável | Light | Dark |
|---|---|---|
| `--paper` | `#f7f8fa` | `#0d121c` |
| `--paper-2` | `#eef1f5` | `#131a28` |
| `--ink` | `#0c1222` | `#e8eef6` |
| `--ink-2` | `#15202b` | `#d4dce8` |
| `--ink-3` | `#3f4e60` | `#9aa8bc` |
| `--ink-4` | `#5c6b7e` | `#7d8b9e` |
| `--rule` | `#d5dbe6` | `#243044` |
| `--rule-2` | `#e4e9f0` | `#1a2436` |

### Accent e semântica

| Variável | Light | Dark |
|---|---|---|
| `--accent` | `#0a5bd7` | `#6aacff` |
| `--accent-2` | `#0847ad` | `#8fc0ff` |
| `--accent-soft` | `#e6effc` | `#152a48` |
| `--marker-green` | `#16a34a` | (igual) |
| `--marker-red` | `#dc2626` | (igual) |
| `--marker-yellow` | `#fef08a` | (igual) |

### Código

| Variável | Light | Dark |
|---|---|---|
| `--code-bg` | `#eef1f5` | `#080c14` |
| `--code-fg` | `#0c1222` | `#e2e8f0` |
| `--code-keyword` | `#6d28d9` | `#c4a1f0` |
| `--code-name` | `#0369a1` | `#6cb6eb` |
| `--code-number` | `#b45309` | `#e0a05a` |
| `--code-string` | `#be123c` | `#e07a72` |

---

## Superfícies

| Token | Valor |
|---|---|
| `--radius` | `10px` |
| `--radius-sm` | `6px` |
| `--shadow-1` | Sombra sutil 1–2px |
| `--shadow-2` | `0 4px 20px -8px rgba(15,23,42,0.15)` |
| `--prose-measure` | `72ch` (76ch @ 1600px, 80ch @ 2200px) |
| `--selection-bg` | `color-mix(in oklab, var(--accent) 22%/35%, transparent)` |

### Grid paper

Classe `.paper` em `body`: fundo com linhas de grade usando `--grid-line`, `--grid-line-2`, `--grid-size` (28px).

---

## Layout shell

```html
<body class="grid paper">
  <nav class="nav">…</nav>
  <div class="container scroll">
    <div class="content">{{ content }}</div>
  </div>
</body>
```

- Scroll interno em `.scroll` (`max-height: calc(100vh - 4.1rem)`)
- `html/body`: `100vh`, `overflow: hidden`

### Padrões de página

| Classe | Uso |
|---|---|
| `.home` | Grid 2-col (posts + sidebar) |
| `.article` | 3-col (TOC + prose + margins) |
| `.projects` | Header + `.repo-grid` |
| `.tool` | Ferramentas interativas |
| `.tool-grid` | Viz + painel lateral (1fr 280px) |

---

## Componentes reutilizáveis

### Botões (`.btn`)

- Sans 13px, padding `8px 14px`, radius 8px, borda `--rule`
- `.btn.primary`: fundo `--accent`, texto branco
- `.btn.sm`: 12px, padding `6px 10px`
- `.btn-group`: grupo segmentado com `.on` invertido

### Painéis (`.panel`)

- Fundo `--paper`, borda `--rule`, radius 10px, padding 16px
- `.row .k / .v`: linhas key/value mono 12px
- `.v.hi`: valor destacado em `--accent`

### Stage (`.stage`)

- Canvas de visualização com grade de fundo, radius 12px, min-height 440px
- `.stage-head`: mono 11px com `.badge` accent-soft

### Tabelas (`css/tables.css`)

- Striped rows com `--accent-soft`
- Hover accent, thead `--paper-2`
- Sticky thead em wrappers scroll

### Filtros (`.filter-row`)

- Pills `.filter` / `.filter.active`
- `.sort-select` para dropdowns

### Tags (`.tag`)

- Mono 11px pill; `.tag.blue` usa `--accent-soft`

---

## Tema claro/escuro

1. Anti-flash script no `<head>` lê `localStorage.getItem("gs-theme")`
2. Fallback: `prefers-color-scheme: dark` → `"dark"`, senão `"light"`
3. Aplica `data-theme` em `<html>`
4. Toggle `#theme-toggle` persiste em **`gs-theme`**
5. Atalho: **Ctrl/Cmd + Shift + L**
6. CSS: seletor `[data-theme="dark"]` redefine tokens em `:root`

**Regra:** nunca hardcodar cores — sempre `var(--token)`.

---

## Breakpoints (mobile-first)

| Breakpoint | Uso |
|---|---|
| Base | Layout empilhado, padding reduzido |
| `min-width: 640px` | Search kbd hint, toolbar horizontal |
| `max-width: 960px` | Nav sheet, home 1-col, article TOC bottom sheet, projects 1-col |
| `max-width: 480px` | Article padding mais apertado |
| `min-width: 1600px` / `2200px` | Prose measure mais largo |

Arquivo principal de overrides: `css/mobile.css` (carregado por último).

---

## Regras para novas ferramentas

1. Usar `layout: default` e wrapper `.tool`
2. Cabeçalho com `.tool-head` + `.eyebrow`
3. Controles com `.btn`, dados com `.panel` / `.stage`
4. SVG/canvas referenciando `var(--accent)`, `var(--ink-*)` — herda tema automaticamente
5. Escrever CSS mobile-first; adicionar overrides em `mobile.css` para ≤960px
6. Inputs/selects: borda `--rule`, fundo `--paper`, radius `--radius-sm`
7. Estados semânticos: `--marker-green` (positivo), `--marker-red` (negativo), `--ink-3` (neutro)
