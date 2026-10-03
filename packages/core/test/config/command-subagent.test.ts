import fs from "fs/promises"
import { describe, expect } from "bun:test"
import path from "path"
import { Effect, Layer } from "effect"
import { LanguageModel } from "@opencode/ai"
import { OpenAIChat } from "@opencode/ai/protocols/openai-chat"
import { TestLLM } from "@opencode/ai/testing"
import { Agent } from "@opencode/core/agent"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { LayerNodePlatform } from "@opencode/core/effect/app-node-platform"
import { Watcher } from "@opencode/core/filesystem/watcher"
import { LocationServiceMap } from "@opencode/core/location-service-map"
import { Model } from "@opencode/core/model"
import { Provider } from "@opencode/core/provider"
import { AbsolutePath } from "@opencode/core/schema"
import { Session } from "@opencode/core/session"
import { Skill } from "@opencode/core/skill"
import { SessionRunnerModel } from "@opencode/core/session/runner/model"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { Global } from "@opencode/util/global"
import { tempGlobalLayer } from "../fixture/global"
import { offlineModels } from "../fixture/models"
import { tmpdirScoped } from "../fixture/tmpdir"
import { testEffect } from "../lib/effect"
import PROMPT_REVIEW from "../../src/plugin/command/review.txt"

const llmLayer = TestLLM.testLayer({ fallback: TestLLM.text("Review complete", "review") })
const it = testEffect(
  Layer.merge(
    llmLayer,
    AppNodeBuilder.build(LayerNode.group([Session.node, LocationServiceMap.node]), [
      Global.node.replace(tempGlobalLayer),
      offlineModels,
      Watcher.node.replace(Watcher.configured({ enabled: false })),
      LayerNodePlatform.llmClient.replace(llmLayer),
      SessionRunnerModel.node.replace(
        Layer.succeed(SessionRunnerModel.Service, {
          resolve: (session) =>
            Effect.succeed(
              SessionRunnerModel.resolved(
                LanguageModel.make({ id: session.model?.id ?? "parent", provider: "test", route: OpenAIChat.route }),
                {
                  capabilities: { tools: true, input: ["text"], output: ["text"] },
                  cost: [],
                  limit: { context: 200_000, output: 32_000 },
                },
              ),
            ),
        }),
      ),
    ]),
  ),
)

const parentModel = Model.Ref.make({ id: Model.ID.make("parent"), providerID: Provider.ID.make("test") })

describe("command subagents", () => {
  it.live("built-in review admits a normal parent prompt with explicit attachments", () =>
    Effect.gen(function* () {
      const parent = yield* project({}, "json", "custom-review")
      const sessions = yield* Session.Service
      const llm = yield* TestLLM.Test
      const gate = yield* llm.gate()

      yield* sessions.command({
        sessionID: parent.id,
        command: "review",
        text: "branch @known.txt @reviewer",
        files: [{ uri: "data:text/plain;base64,U1VQUExJRURfQVRUQUNITUVOVA==", name: "explicit.txt" }],
        agents: [{ name: "lead" }],
        skills: [{ id: Skill.ID.make("security") }],
      })
      yield* gate.started
      expect((yield* sessions.list({ parentID: parent.id })).data).toEqual([])
      expect(yield* sessions.get(parent.id)).toMatchObject({ agent: "build", model: parentModel })
      const users = (yield* sessions.context(parent.id)).filter((message) => message.type === "user")
      expect(users).toHaveLength(1)
      expect(users[0]).toMatchObject({
        text: PROMPT_REVIEW.replace("${path}", parent.location.directory).replaceAll(
          "$ARGUMENTS",
          "branch @known.txt @reviewer",
        ),
        agents: [{ name: "lead" }],
        skills: [{ id: "security", name: "Security" }],
      })
      expect(users[0]?.files).toHaveLength(1)
      const request = JSON.stringify((yield* llm.requests())[0])
      expect(request).toContain("SUPPLIED_ATTACHMENT")
      expect(request).toContain("# Security guide")
      yield* gate.release
      yield* sessions.wait(parent.id)
    }),
  )

  for (const fixture of [
    {
      name: "native JSON",
      format: "json",
      command: { subagent: true, agent: "build", model: "test/override" },
      agent: "build",
      model: "override",
    },
    {
      name: "native JSON alias",
      format: "json",
      command: { subtask: true, agent: "build", model: "test/override" },
      agent: "build",
      model: "override",
    },
    {
      name: "legacy JSON",
      format: "legacy-json",
      command: { subtask: true, agent: "build", model: "test/override" },
      agent: "build",
      model: "override",
    },
    {
      name: "native Markdown",
      format: "markdown",
      command: { subagent: true, agent: "build" },
      agent: "build",
      model: "parent",
    },
    {
      name: "legacy Markdown",
      format: "markdown",
      command: { subtask: true, agent: "build" },
      agent: "build",
      model: "parent",
    },
    {
      name: "subagent mode by default",
      format: "json",
      command: { agent: "reviewer" },
      agent: "reviewer",
      model: "child",
    },
  ] as const) {
    it.live(`runs ${fixture.name} in the background without switching the parent`, () =>
      Effect.gen(function* () {
        const parent = yield* project(fixture.command, fixture.format)
        const sessions = yield* Session.Service
        const llm = yield* TestLLM.Test
        const gate = yield* llm.gate()

        // This must return while the child's model is still blocked.
        yield* sessions.command({ sessionID: parent.id, command: "review", text: "changes" })
        yield* gate.started
        const children = (yield* sessions.list({ parentID: parent.id })).data
        expect(children).toHaveLength(1)
        const child = children[0]
        if (!child) return yield* Effect.die("Expected a child session")
        expect(child).toMatchObject({ agent: fixture.agent, model: { id: fixture.model }, title: "Review code" })
        expect(yield* sessions.get(parent.id)).toMatchObject({ agent: "build", model: parentModel })
        expect(yield* sessions.context(parent.id)).toEqual([])
        expect(yield* llm.requests()).toHaveLength(1)
        expect((yield* sessions.context(child.id)).filter((message) => message.type === "user")).toMatchObject([
          { text: "You are a subagent spawned by another session.\nReview changes: ready" },
        ])
        yield* gate.release
        yield* llm.wait(2)
        yield* sessions.wait(parent.id)
        const notices = (yield* sessions.context(parent.id)).filter((message) => message.type === "synthetic")
        expect(notices).toMatchObject([{ metadata: { source: "subagent", childID: child.id, state: "completed" } }])
        expect(notices[0]?.text).toContain("Review complete")
      }),
    )
  }

  it.live(
    "subagent: false overrides subagent mode and switches parent agent and model while forwarding attachments",
    () =>
      Effect.gen(function* () {
        const parent = yield* project(
          {
            subagent: false,
            subtask: true,
            agent: "reviewer",
            model: "test/override",
            template: "Review @src/button.tsx with @reviewer: $ARGUMENTS: !`printf ready`",
          },
          "json",
        )
        const sessions = yield* Session.Service
        yield* sessions.command({
          sessionID: parent.id,
          command: "review",
          text: "changes",
          files: [{ uri: "data:text/plain;base64,ZXhwb3J0IGNvbnN0IGJ1dHRvbiA9IHRydWU=", name: "button.tsx" }],
          agents: [{ name: "lead" }],
          skills: [{ id: Skill.ID.make("security") }],
        })
        yield* sessions.wait(parent.id)
        expect((yield* sessions.list({ parentID: parent.id })).data).toEqual([])
        expect(yield* sessions.get(parent.id)).toMatchObject({
          agent: "reviewer",
          model: { id: "override" },
        })
        const userMessages = (yield* sessions.context(parent.id)).filter((message) => message.type === "user")
        expect(userMessages).toHaveLength(1)
        expect(userMessages[0]).toMatchObject({
          text: "Review @src/button.tsx with @reviewer: changes: ready",
          agents: [{ name: "lead" }],
          skills: [{ id: "security", name: "Security" }],
        })
        expect(userMessages[0]?.files).toHaveLength(1)
        expect(userMessages[0]?.files?.[0]).toMatchObject({
          name: "button.tsx",
        })
      }),
  )

  it.live("legacy subtask: false overrides subagent mode and switches parent agent and model", () =>
    Effect.gen(function* () {
      const parent = yield* project(
        {
          subtask: false,
          agent: "reviewer",
          model: "test/override",
          template: "Review $ARGUMENTS: !`printf ready`",
        },
        "legacy-json",
      )
      const sessions = yield* Session.Service
      yield* sessions.command({
        sessionID: parent.id,
        command: "review",
        text: "changes",
      })
      yield* sessions.wait(parent.id)
      expect((yield* sessions.list({ parentID: parent.id })).data).toEqual([])
      expect(yield* sessions.get(parent.id)).toMatchObject({
        agent: "reviewer",
        model: { id: "override" },
      })
      const userMessages = (yield* sessions.context(parent.id)).filter((message) => message.type === "user")
      expect(userMessages).toHaveLength(1)
      expect(userMessages[0]?.text).toBe("Review changes: ready")
    }),
  )

  for (const subagent of [false, true]) {
    it.live(
      `native subagent=${subagent}: existing mentions do not synthesize attachments; supplied files and skills reach the model`,
      () =>
        Effect.gen(function* () {
          const parent = yield* project(
            {
              subagent,
              agent: subagent ? "reviewer" : "build",
              template: "Read @known.txt with @reviewer and @missing.txt: $ARGUMENTS",
            },
            "json",
          )
          const sessions = yield* Session.Service
          yield* Effect.promise(() => Bun.write(path.join(parent.location.directory, "known.txt"), "UNATTACHED_SECRET"))
          const llm = yield* TestLLM.Test
          const gate = yield* llm.gate()

          yield* sessions.command({
            sessionID: parent.id,
            command: "review",
            text: "inspect",
            files: [{ uri: "data:text/plain;base64,U1VQUExJRURfQVRUQUNITUVOVA==", name: "explicit.txt" }],
            agents: [{ name: "lead" }],
            skills: [{ id: Skill.ID.make("security") }],
          })
          yield* gate.started
          const children = (yield* sessions.list({ parentID: parent.id })).data
          const targetID = subagent ? children[0]?.id : parent.id
          if (!targetID) return yield* Effect.die("Expected target session")

          const user = (yield* sessions.context(targetID)).find((message) => message.type === "user")
          expect(user?.files).toHaveLength(1)
          expect(user?.files?.[0]).toMatchObject({ name: "explicit.txt" })
          expect(user?.agents).toEqual([{ name: "lead" }])
          expect(user?.skills).toMatchObject([{ id: "security", name: "Security" }])
          expect(user?.text).toContain("@known.txt with @reviewer and @missing.txt")

          const requests = yield* llm.requests()
          const requestJson = JSON.stringify(requests[0])
          expect(requestJson).toContain("SUPPLIED_ATTACHMENT")
          expect(requestJson).toContain("# Security guide")
          expect(requestJson).not.toContain("UNATTACHED_SECRET")

          yield* gate.release
          if (subagent) yield* llm.wait(2)
          yield* sessions.wait(parent.id)
        }),
    )
  }
})

function project(
  command: { agent?: string; model?: string; subagent?: boolean; subtask?: boolean; template?: string },
  format: "json" | "legacy-json" | "markdown",
  name = "review",
) {
  return Effect.gen(function* () {
    const tmp = yield* tmpdirScoped()
    const definition = {
      description: "Review code",
      template: command.template ?? "Review $ARGUMENTS: !`printf ready`",
      ...command,
    }
    yield* Effect.promise(async () => {
      await fs.mkdir(path.join(tmp.path, ".opencode", "skills", "security"), { recursive: true })
      await fs.writeFile(
        path.join(tmp.path, ".opencode", "skills", "security", "SKILL.md"),
        "---\nname: Security\ndescription: Security inspection\n---\n# Security guide",
      )
      await Bun.write(
        path.join(tmp.path, "opencode.json"),
        JSON.stringify({
          agents: { reviewer: { mode: "subagent", model: "test/child" } },
          ...(format === "markdown"
            ? {}
            : { [format === "legacy-json" ? "command" : "commands"]: { [name]: definition } }),
        }),
      )
    })
    if (format === "markdown")
      yield* Effect.promise(() =>
        Bun.write(
          path.join(tmp.path, ".opencode/commands", `${name}.md`),
          [
            "---",
            "description: Review code",
            ...Object.entries(command).map(([key, value]) => `${key}: ${value}`),
            "---",
            definition.template,
          ].join("\n"),
        ),
      )
    const sessions = yield* Session.Service
    return yield* sessions.create({
      location: { directory: AbsolutePath.make(tmp.path) },
      title: "Parent session",
      agent: Agent.ID.make("build"),
      model: parentModel,
    })
  })
}
