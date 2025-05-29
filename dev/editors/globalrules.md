# Global Editor Rules
## Windsurf Wrapper:
```xml
<GlobalRules>
…(global rules here)…
</GlobalRules>
```

## Cursor Wrapper:
```Markdown
.cursorrules
-----------
## Always
…(global rules here)…
```


## Rules:
```Markdown
### UNIVERSAL STYLE
- TypeScript ^5.4 only; `noImplicitAny: true`, `strict: true`
- Prettier: {"semi":false,"useTabs":true,"singleQuote":true}
- Use arrow/function **expressions**; ban function declarations
- One exported symbol per file
- Never use: `any`, `enum`, unnamed generics

### PROJECT LAYOUT
- Runtime code lives in repo-specific “source root” (decide per project)
- Tests in `tests/`; tooling in `scripts/`
- Import depth ≤ 2 (`../../file` max)
- Do **not** commit secrets or `.env.*`

### REACT / RN
- React 19 functional components; no `class` components
- Hooks: type all state/setters (`useState<number>(0)`)
- Styling: Tailwind (web) or nativewind / styled-components (RN)

### DATA & NETWORK
- Use TanStack Query + Zod schemas
- Default ORM: Drizzle; override per project
- Prefer tRPC for internal API, REST only when integrating externals

### QUALITY GATES
- Commands:  
  `pnpm dev` · `pnpm build` · `pnpm test` · `pnpm lint --fix`  
  Agent must lint & test before proposing code
- No `console.log` in committed code (use logger util)
- Every exported fn/component gets a colocated test
```