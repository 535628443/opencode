import re
f="packages/session-ui/src/tools/tool-renderer.tsx"
content = open(f).read()
content = re.sub(
    r"<<<<<<< HEAD\n\n      if \(typeof value === \"string\" && value\) return value\n\n=======\n      if \(typeof value === \"string\" && value\) return SessionID\.make\(value, \{ disableChecks: true \}\)\n>>>>>>>[^\n]+\n",
    r"\n      if (typeof value === \"string\" && value) return SessionID.make(value, { disableChecks: true })\n",
    content,
    flags=re.DOTALL
)
open(f,"w").write(content)
