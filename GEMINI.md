# Strict Workspace Guidelines

## STRICT USER CONSTRAINT: NO BROWSER / NO SCREEN ACCESS
- **NEVER use `browser_subagent` or open Chrome / any browser.**
- **NEVER attempt to take screen access or control the user's browser.**
- The user will always test UI and pages directly themselves in their own browser.
- All testing and verification by the AI must be done solely via terminal, code inspection, and TypeScript compiler (`node ./node_modules/typescript/bin/tsc --noEmit`).
