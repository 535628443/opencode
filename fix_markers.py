import re
import os

files_to_fix = [
  "packages/app/src/session/composer/queue.test.ts",
  "packages/app/src/session/composer/queue.ts",
  "packages/app/src/session/session-identity-header.tsx",
  "packages/app/src/session/timeline/controller-projection.test.ts",
  "packages/app/src/session/timeline/interaction.ts",
  "packages/session-ui/src/actions.ts",
  "packages/session-ui/src/timeline/projection.ts",
  "packages/session-ui/src/timeline/session-timeline-row.tsx",
  "packages/session-ui/src/tools/tool-renderer.tsx",
  "packages/tui/test/cli/tui/composer-keymap.test.tsx",
  "packages/tui/test/component/dialog-shell-output.test.tsx",
  "packages/tui/test/context/local-selection.test.tsx"
]

def choose_bottom(m):
    return m.group(2)

def choose_top(m):
    return m.group(1)

for f in files_to_fix:
    path = os.path.join(".", f)
    if not os.path.exists(path): continue
    content = open(path).read()
    
    if "session-identity-header.tsx" in f:
        # manual replacement since there are two conflicts
        pass
    else:
        # In most of these, the bottom (cherry-picked) is what we wanted, but with some upstream types preserved.
        # Let's just print the diffs to handle them properly.
        pass

