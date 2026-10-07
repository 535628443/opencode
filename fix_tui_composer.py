import re
f="packages/tui/test/cli/tui/composer-keymap.test.tsx"
content = open(f).read()

# Since this test setup was heavily refactored in v2, I will keep the HEAD (v2) but with the ID fixes from the branch if there's any.
content = re.sub(
    r"<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>>[^\n]+\n",
    r"\1",
    content,
    flags=re.DOTALL
)
open(f,"w").write(content)
