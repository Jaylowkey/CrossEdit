# CrossEdit modules

Cada funcionalidade nova deve ser organizada numa pasta própria dentro de `src/modules/`.

Estrutura recomendada:

```text
src/modules/nome-da-funcionalidade/
  components/
  hooks/
  services/
  types.ts
  index.ts
```

Os módulos devem comunicar com o documento através de serviços partilhados, sem duplicar o estado principal do editor. Não importar APIs do Electron diretamente para React; usar apenas a ponte segura `window.crossEdit`.
