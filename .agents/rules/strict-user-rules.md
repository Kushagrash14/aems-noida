# Strict User Rules & Behavioral Constraints

## 1. ABSOLUTE PROHIBITION ON BROWSER ACCESS / SCREEN ACCESS
- **DO NOT OPEN CHROME OR ANY BROWSER WINDOW.**
- **DO NOT USE `browser_subagent` OR ANY BROWSER / SCREEN RECORDING TOOLS.**
- The user tests UI and pages manually in their own browser.
- Taking screen access or launching automated Chrome sessions is strictly forbidden by the user.

## 2. Verification Protocol
- Verify all code and changes strictly using:
  - TypeScript compilation: `node ./node_modules/typescript/bin/tsc --noEmit`
  - Code analysis and unit/scratch scripts
  - Terminal commands
- Never launch browser subagents for visual verification.
