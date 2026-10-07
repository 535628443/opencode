import re
def fix(f, p, r):
    content = open(f).read()
    content = re.sub(p, r, content, flags=re.DOTALL)
    open(f, "w").write(content)

# timeline-row.ts
fix("packages/session-ui/src/timeline/timeline-row.ts",
    r'import type \{ SessionMessage \} from \\"@opencode/schema/session-message\\"\nimport \{ Data, Equal, Match \} from \\"effect\\"',
    r'import type { SessionMessage } from "@opencode/schema/session-message"\nimport { Data, Equal, Match } from "effect"'
)

# tool-renderer.tsx (line 1445)
fix("packages/session-ui/src/tools/tool-renderer.tsx",
    r'if \(typeof value === \\"string\\" && value\) return SessionID\.make\(value, \{ disableChecks: true \}\)',
    r'if (typeof value === "string" && value) return SessionID.make(value, { disableChecks: true })'
)

# tool-renderer.tsx (line 1855 missing semicolon/newline)
fix("packages/session-ui/src/tools/tool-renderer.tsx",
    r'if \(typeof value === "string" && value\) return SessionID\.make\(value, \{ disableChecks: true \}\)      return taskSession\(props\.input, data\.sessionID, data\.store\.session\)',
    r'if (typeof value === "string" && value) return SessionID.make(value, { disableChecks: true })\n      return taskSession(props.input, data.sessionID, data.store.session)'
)

# tool-renderer.tsx (line 2074)
fix("packages/session-ui/src/tools/tool-renderer.tsx",
    r'\(typeof props\.metadata\.shellID === \\"string\\" && data\.shellRunning\?\.([^)]+)\) === true\)',
    r'(typeof props.metadata.shellID === "string" && data.shellRunning?.(\1) === true)'
)
