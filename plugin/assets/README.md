# Ringly — assets

Esta pasta guarda os dois ícones que aparecem nas notificações (toast) do Windows.
Ambos são publicados junto do pacote npm (`package.json` → `files` inclui `plugin/`),
então acompanham tanto o plugin quanto a CLI.

| Arquivo | Onde aparece | Como é mantido |
|---|---|---|
| `ringly.png` | **Imagem grande dentro** do toast (`appLogoOverride`) | arquivo estático (a estrela do Claude Code) |
| `ringly.ico` | **Ícone do canto/topo** do toast (via atalho do Menu Iniciar / AUMID) | **gerado** por `scripts/gen-icon.mjs` |

---

## `ringly.png` — imagem grande do toast

1. PNG quadrado com o nome exato **`ringly.png`** nesta pasta.
2. Recomendado: **256×256 (ou maior), fundo transparente**, arte centralizada.
3. Resolução em runtime: `src/platform/windows/icon.ts` (`resolveIconPath`). Se o
   arquivo não existir, o toast aparece **sem** a imagem grande (degradação graciosa).
4. Referenciado no XML do toast como
   `<image placement="appLogoOverride" hint-crop="none" src="file:///…/ringly.png"/>`.

## `ringly.ico` — ícone do canto

O ícone do canto do toast vem do atalho **`Claude Code.lnk`** no Menu Iniciar (o
AUMID). Sem um `.ico` próprio, o Windows usava o ícone do `node.exe` (o logo verde
do Node). O `ringly.ico` substitui isso pelo ícone do Ringly (ondas concêntricas
ciano, igual ao favicon do site).

- Resolução em runtime: `src/platform/windows/icon.ts` (`resolveShortcutIconPath`).
- Aplicado no registro do atalho: `src/platform/windows/aumid.ts` (`detectIconPath`).
- Quem já tinha o atalho com o ícone do Node: rodar **`ringly init`** uma vez
  reescreve o atalho com o `ringly.ico` (o registro detecta o ícone divergente).

### Como regenerar o `ringly.ico`

> **Windows-only.** O gerador usa PowerShell + `System.Drawing` para rasterizar a
> geometria, então o `.ico` é gerado no Windows e **commitado** (o CI roda em
> Linux/macOS e não o regenera).

```powershell
npm run build             # gera dist/ico.js (o empacotador ICO testado)
node scripts/gen-icon.mjs # desenha 16/32/48/64/128/256 e grava plugin/assets/ringly.ico
```

A geometria espelha `Ringly-landing/public/favicon.svg` (viewBox 32; retângulo
arredondado `rx=7`; anéis `r=6/10.5/14` + ponto central `r=2`; ciano `#67E8F9`
sobre fundo `#0A0B0F`). O empacotamento binário do `.ico` vive em
`src/platform/windows/ico.ts` (`packIco`) e é coberto por `test/ico.test.ts`.
