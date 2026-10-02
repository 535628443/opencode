import { describe, expect, test } from "bun:test"
import { formatPendingCommandText, PendingCommands } from "../../src/component/prompt/pending-command"
import type { PromptInfo } from "../../src/prompt/history"

describe("pending slash commands", () => {
  test("adds and lists pending commands for a session", () => {
    PendingCommands.clear("ses_1")

    const cmd = PendingCommands.add({
      sessionID: "ses_1",
      name: "mcp-prompt",
      arguments: "arg1 arg2",
      delivery: "steer",
    })

    expect(cmd.id).toBeDefined()
    expect(cmd.name).toBe("mcp-prompt")
    expect(cmd.arguments).toBe("arg1 arg2")
    expect(cmd.delivery).toBe("steer")

    const list = PendingCommands.list("ses_1")
    expect(list).toHaveLength(1)
    expect(list[0]).toEqual(cmd)

    PendingCommands.remove(cmd.id, "ses_1")
    expect(PendingCommands.list("ses_1")).toHaveLength(0)
  })

  test("preserves attachments, agents, skills, and delivery mode", () => {
    PendingCommands.clear("ses_attachments")

    const files: PromptInfo["files"] = [{ uri: "file:///test.txt", name: "test.txt" }]
    const agents: PromptInfo["agents"] = [{ name: "builder" }]
    const skills: PromptInfo["skills"] = [{ id: "skill_1" as any }]

    const cmd = PendingCommands.add({
      sessionID: "ses_attachments",
      name: "review-code",
      arguments: "--verbose",
      delivery: "queue",
      files,
      agents,
      skills,
    })

    expect(cmd.files).toEqual(files)
    expect(cmd.agents).toEqual(agents)
    expect(cmd.skills).toEqual(skills)
    expect(cmd.delivery).toBe("queue")

    PendingCommands.clear("ses_attachments")
  })

  test("isolates pending commands across multiple sessions", () => {
    PendingCommands.clear("ses_a")
    PendingCommands.clear("ses_b")

    const cmdA = PendingCommands.add({
      sessionID: "ses_a",
      name: "cmd-a",
      delivery: "steer",
    })

    const cmdB = PendingCommands.add({
      sessionID: "ses_b",
      name: "cmd-b",
      delivery: "steer",
    })

    expect(PendingCommands.list("ses_a")).toEqual([cmdA])
    expect(PendingCommands.list("ses_b")).toEqual([cmdB])
    expect(PendingCommands.list("ses_c")).toEqual([])

    PendingCommands.remove(cmdA.id, "ses_a")
    expect(PendingCommands.list("ses_a")).toEqual([])
    expect(PendingCommands.list("ses_b")).toEqual([cmdB])

    PendingCommands.remove(cmdB.id, "ses_b")
    expect(PendingCommands.list("ses_b")).toEqual([])
  })

  test("handles multiple concurrent submissions in the same session without colliding", () => {
    PendingCommands.clear("ses_multi")

    const cmd1 = PendingCommands.add({
      sessionID: "ses_multi",
      name: "mcp-slow-1",
      arguments: "first",
      delivery: "steer",
    })

    const cmd2 = PendingCommands.add({
      sessionID: "ses_multi",
      name: "mcp-slow-2",
      arguments: "second",
      delivery: "steer",
    })

    const cmd3 = PendingCommands.add({
      sessionID: "ses_multi",
      name: "mcp-slow-1", // repeated submission of same command name
      arguments: "third",
      delivery: "queue",
    })

    expect(cmd1.id).not.toBe(cmd2.id)
    expect(cmd1.id).not.toBe(cmd3.id)

    expect(PendingCommands.list("ses_multi")).toEqual([cmd1, cmd2, cmd3])

    // Removing cmd2 leaves cmd1 and cmd3
    PendingCommands.remove(cmd2.id, "ses_multi")
    expect(PendingCommands.list("ses_multi")).toEqual([cmd1, cmd3])

    // Removing cmd1 leaves cmd3
    PendingCommands.remove(cmd1.id, "ses_multi")
    expect(PendingCommands.list("ses_multi")).toEqual([cmd3])

    PendingCommands.remove(cmd3.id, "ses_multi")
    expect(PendingCommands.list("ses_multi")).toEqual([])
  })

  test("formats pending command display text correctly for various options", () => {
    expect(
      formatPendingCommandText({
        id: "1",
        sessionID: "s",
        name: "test-cmd",
        delivery: "steer",
      }),
    ).toBe("Resolving /test-cmd…")

    expect(
      formatPendingCommandText({
        id: "2",
        sessionID: "s",
        name: "test-cmd",
        arguments: "arg1 arg2",
        delivery: "steer",
      }),
    ).toBe("Resolving /test-cmd arg1 arg2…")

    expect(
      formatPendingCommandText({
        id: "3",
        sessionID: "s",
        name: "test-cmd",
        arguments: "arg1",
        delivery: "queue",
      }),
    ).toBe("Resolving /test-cmd arg1 (queue)…")

    expect(
      formatPendingCommandText(
        {
          id: "4",
          sessionID: "s",
          name: "test-cmd",
          delivery: "steer",
        },
        3,
      ),
    ).toBe("Resolving /test-cmd (+3 more)…")
  })
})
