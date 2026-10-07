import re
f="packages/app/src/session/timeline/interaction.ts"
content = open(f).read()

# First block
content = re.sub(
    r"<<<<<<< HEAD\n\n  const \[state, setState\] = createStore<\{\n    messageID: string \| undefined\n    pendingMessage: string \| undefined\n(.*?)\n=======\n  const \[state, setState\] = createStore\(\{\n    messageID: undefined as SessionMessage\.ID \| undefined,\n    pendingMessage: undefined as SessionMessage\.ID \| undefined,\n>>>>>>>[^\n]+\n",
    r"  const [state, setState] = createStore<{\n    messageID: SessionMessage.ID | undefined\n    pendingMessage: SessionMessage.ID | undefined\n\1",
    content,
    flags=re.DOTALL
)

# Second block
content = re.sub(
    r"<<<<<<< HEAD\n  // The history entry whose tool call was already revealed\.\n  let revealed: string \| undefined\n\n  // The active timeline's navigation, registered by its virtualizer\.\n  let revealMessage = \(_id: string, _partID\?: string\) => \{\}\n\n=======\n  let revealMessage = \(_id: SessionMessage\.ID, _partID\?: string\) => \{\}\n>>>>>>>[^\n]+\n",
    r"  // The history entry whose tool call was already revealed.\n  let revealed: string | undefined\n\n  // The active timeline's navigation, registered by its virtualizer.\n  let revealMessage = (_id: SessionMessage.ID, _partID?: string) => {}\n\n",
    content,
    flags=re.DOTALL
)
open(f,"w").write(content)
