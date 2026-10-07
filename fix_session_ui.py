import re
import sys

def repl(f, pattern, replacer):
    with open(f, 'r') as file:
        content = file.read()
    content = re.sub(pattern, replacer, content, flags=re.DOTALL)
    with open(f, 'w') as file:
        file.write(content)

# actions.ts
repl("packages/session-ui/src/actions.ts", 
     r"<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>>[^\n]+\n",
     r"\2")

# projection.ts
repl("packages/session-ui/src/timeline/projection.ts",
     r"<<<<<<< HEAD\n(.*?)pendingInputIDs\?: ReadonlySet<string>\n(.*?)queuedCompactionIDs(.*?)\n=======\n(.*?)pendingUserMessageIDs(.*?)\n>>>>>>>[^\n]+\n",
     lambda m: m.group(1) + "pendingUserMessageIDs?: ReadonlySet<SessionMessage.ID>\n" + m.group(2) + "queuedCompactionIDs" + m.group(3) + "\n")

# projection.ts (localModel part)
repl("packages/session-ui/src/timeline/projection.ts",
     r"<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>>[^\n]+\n",
     r"\2")

# rows-current.test.ts
repl("packages/session-ui/src/timeline/rows-current.test.ts",
     r"<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>>[^\n]+\n",
     r"\2")

# session-timeline-row.tsx
repl("packages/session-ui/src/timeline/session-timeline-row.tsx",
     r"<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>>[^\n]+\n",
     r"\2")

# timeline-row.ts
repl("packages/session-ui/src/timeline/timeline-row.ts",
     r"<<<<<<< HEAD\nimport \{ Data, Equal, Match \} from \"effect\"\n=======\nimport type \{ SessionMessage \} from \"@opencode/schema/session-message\"\nimport \{ Data, Equal \} from \"effect\"\n>>>>>>>[^\n]+\n",
     "import type { SessionMessage } from \"@opencode/schema/session-message\"\nimport { Data, Equal, Match } from \"effect\"\n")

repl("packages/session-ui/src/timeline/timeline-row.ts",
     r"<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>>[^\n]+\n",
     r"\2  CompactionQueued: { userMessageID: SessionMessage.ID; inboxID: SessionMessage.ID }\n")

# tool-renderer.tsx
repl("packages/session-ui/src/tools/tool-renderer.tsx",
     r"<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>>[^\n]+\n",
     r"\2")


