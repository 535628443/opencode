import re
f="packages/session-ui/src/actions.ts"
content = open(f).read()
content = re.sub(
    r"<<<<<<< HEAD\n  revert\?: \(input: \{ sessionID: string; messageID: string \}\) => Promise<void> \| void\n  /\*\* A steer the server has not delivered yet\. Like the TUI, it can move to the queue or be deleted\. \*/\n  pending\?: \{\n    steer: \(messageID: string\) => boolean\n    queue: \(input: \{ sessionID: string; messageID: string \}\) => Promise<void>\n    remove: \(input: \{ sessionID: string; messageID: string \}\) => Promise<void>\n  \}\n=======\n  revert\?: \(input: \{ sessionID: SessionID; messageID: SessionMessage\.ID \}\) => Promise<void> \| void\n>>>>>>>[^\n]+\n",
    r"  revert?: (input: { sessionID: SessionID; messageID: SessionMessage.ID }) => Promise<void> | void\n  /** A steer the server has not delivered yet. Like the TUI, it can move to the queue or be deleted. */\n  pending?: {\n    steer: (messageID: SessionMessage.ID) => boolean\n    queue: (input: { sessionID: SessionID; messageID: SessionMessage.ID }) => Promise<void>\n    remove: (input: { sessionID: SessionID; messageID: SessionMessage.ID }) => Promise<void>\n  }\n",
    content,
    flags=re.DOTALL
)
open(f,"w").write(content)
