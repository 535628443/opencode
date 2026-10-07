import re

f = "packages/app/src/session/timeline/controller-projection.test.ts"
content = open(f).read()

# First block:
content = re.sub(
    r'<<<<<<< HEAD\n<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>>[^\n]+\n=======\n(.*?)\n>>>>>>>[^\n]+\n',
    lambda m: m.group(1),
    content,
    flags=re.DOTALL
)

# Second block:
content = re.sub(
    r'<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>>[^\n]+\n',
    lambda m: m.group(1),
    content,
    flags=re.DOTALL
)

open(f, 'w').write(content)
