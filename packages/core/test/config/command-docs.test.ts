import { expect, test } from "bun:test"
import { parse } from "jsonc-parser"
import { ConfigNormalize } from "@opencode/core/config/normalize"

test("command documentation JSON examples are valid V2 configurations", async () => {
  const content = await Bun.file(new URL("../../../web/src/content/docs/commands.mdx", import.meta.url)).text()
  const examples = Array.from(content.matchAll(/^```json[^\n]*\n([\s\S]*?)^```/gm))
  expect(examples.length).toBeGreaterThan(0)
  for (const example of examples) {
    const result = ConfigNormalize.normalize(parse(example[1] ?? ""))
    expect(result.type).toBe("normalized")
    expect(result.diagnostics).toEqual([])
  }
})
