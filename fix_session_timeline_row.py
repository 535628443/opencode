import re
f="packages/session-ui/src/timeline/session-timeline-row.tsx"
content = open(f).read()

# First block
content = re.sub(
    r"<<<<<<< HEAD\n\n  const workingTurn = \(messageID: string\) =>\n    input\.status\(\)\.type !== \"idle\" && input\.projection\.activeMessageID\(\) === messageID\n\n  const duration = \(messageID: string\) => \{\n=======\n  const workingTurn = \(messageID: SessionMessage\.ID\) =>\n    input\.status\(\)\.type !== \"idle\" && input\.projection\.activeMessageID\(\) === messageID\n  const duration = \(messageID: SessionMessage\.ID\) => \{\n>>>>>>>[^\n]+\n",
    r"\n  const workingTurn = (messageID: SessionMessage.ID) =>\n    input.status().type !== \"idle\" && input.projection.activeMessageID() === messageID\n\n  const duration = (messageID: SessionMessage.ID) => {\n",
    content,
    flags=re.DOTALL
)
open(f,"w").write(content)
