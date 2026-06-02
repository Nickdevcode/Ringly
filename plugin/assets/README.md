# Ringly — assets

Coloque aqui o ícone do app usado nas notificações (toast) do Windows.

## Como adicionar a logo

1. Salve um arquivo PNG quadrado com o nome exato **`ringly.png`** nesta pasta
   (`plugin/assets/ringly.png`).
2. Recomendado: **PNG quadrado, fundo transparente, 256×256** (ou maior). O
   Windows recorta em círculo (`hint-crop="circle"`) no `appLogoOverride`, então
   uma arte centralizada fica melhor.
3. Pronto. O Ringly resolve o caminho em runtime e passa a exibir o ícone no
   toast. Se o arquivo **não** existir, a notificação simplesmente aparece sem
   ícone (degradação graciosa) — nada quebra.

## Detalhes técnicos

- O ícone é referenciado no XML do toast como
  `<image placement="appLogoOverride" hint-crop="circle" src="file:///…/ringly.png"/>`.
- A resolução do caminho está em `src/platform/windows/icon.ts` (procura em
  `CLAUDE_PLUGIN_ROOT/assets/` e relativo ao módulo empacotado).
- O arquivo é publicado junto do pacote npm (`package.json` → `files` inclui
  `plugin/`), então acompanha tanto o plugin quanto a CLI.

> Observação: até a logo definitiva ser adicionada, este `README.md` mantém a
> pasta versionada. Pode trocar/atualizar o `ringly.png` quando quiser.
