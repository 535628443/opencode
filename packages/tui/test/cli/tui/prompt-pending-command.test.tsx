/** @jsxImportSource @opentui/solid */
import { TextareaRenderable } from "@opentui/core"
import { testRender } from "@opentui/solid"
import { expect, test } from "bun:test"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import { createSignal, onMount } from "solid-js"
import { Prompt, PromptInterruptStatus, type PromptRef } from "../../../src/component/prompt"
import {
  PendingCommands,
  PromptPendingCommands,
  formatPendingCommandText,
  type PendingCommand,
} from "../../../src/component/prompt/pending-command"
import { ConfigProvider } from "../../../src/config"
import { ArgsProvider } from "../../../src/context/args"
import { ClientProvider } from "../../../src/context/client"
import { DataProvider, useData } from "../../../src/context/data"
import { EditorContextProvider } from "../../../src/context/editor"
import { Keymap } from "../../../src/context/keymap"
import { LocalProvider, useLocal } from "../../../src/context/local"
import { LocationProvider, useLocation } from "../../../src/context/location"
import { PermissionProvider } from "../../../src/context/permission"
import { PromptRefProvider, usePromptRef } from "../../../src/context/prompt"
import { RouteProvider, useRoute } from "../../../src/context/route"
import { SessionTabsProvider } from "../../../src/context/session-tabs"
import { StorageProvider, useStorage } from "../../../src/context/storage"
import { ThemeProvider, useTheme } from "../../../src/context/theme"
import { TuiAppProvider, TuiLifecycleProvider } from "../../../src/context/runtime"
import { AttentionProvider } from "../../../src/context/attention"
import { ExitProvider } from "../../../src/context/exit"
import { PluginProvider } from "../../../src/plugin/context"
import { DialogProvider } from "../../../src/ui/dialog"
import { ToastProvider } from "../../../src/ui/toast"
import { PromptHistoryProvider } from "../../../src/prompt/history"
import { PromptStashProvider } from "../../../src/prompt/stash"
import { FrecencyProvider } from "../../../src/prompt/frecency"
import { emptyThemeSource, tmpdir } from "../../fixture/fixture"
import { createApi, createEventStream, createFetch, directory, json, type FetchHandler } from "../../fixture/tui-client"
import { TestTuiContexts } from "../../fixture/tui-environment"
import { createTuiResolvedConfig } from "../../fixture/tui-runtime"
import { agent, model, session } from "../../fixture/local"

async function wait(fn: () => boolean, timeout = 2000) {
  const start = Date.now()
  while (!fn()) {
    if (Date.now() - start > timeout) throw new Error("timed out waiting for condition")
    await Bun.sleep(10)
  }
}

test("formatPendingCommandText formats single, queued, and multiple commands", () => {
  const single: PendingCommand = {
    id: "1",
    sessionID: "s1",
    name: "mcp-cmd",
    arguments: "arg1",
    delivery: "steer",
  }
  expect(formatPendingCommandText(single)).toBe("Resolving /mcp-cmd arg1…")

  const queued: PendingCommand = {
    id: "2",
    sessionID: "s1",
    name: "mcp-cmd",
    arguments: "arg1",
    delivery: "queue",
  }
  expect(formatPendingCommandText(queued)).toBe("Resolving /mcp-cmd arg1 (queue)…")

  expect(formatPendingCommandText(single, 2)).toBe("Resolving /mcp-cmd arg1 (+2 more)…")
})

test("PromptPendingCommands renders in narrow and wide terminal layouts", async () => {
  const command: PendingCommand = {
    id: "cmd_1",
    sessionID: "s1",
    name: "slow-prompt",
    arguments: "hello world",
    delivery: "steer",
  }

  for (const width of [40, 120]) {
    function LayoutHarness() {
      const theme = useTheme()
      return (
        <box width={width} height={2} flexDirection="row" gap={1}>
          <PromptPendingCommands commands={[command]} />
          <PromptInterruptStatus
            armed={false}
            text={theme.text.base}
            subdued={theme.text.muted}
            warning={theme.text.feedback.warning.base}
          />
        </box>
      )
    }

    const app = await testRender(
      () => (
        <TestTuiContexts cwd="/tmp/opencode">
          <ConfigProvider config={createTuiResolvedConfig({ animations: false })}>
            <ThemeProvider mode="dark" source={emptyThemeSource}>
              <LayoutHarness />
            </ThemeProvider>
          </ConfigProvider>
        </TestTuiContexts>
      ),
      { width, height: 2 },
    )
    app.renderer.start()

    try {
      await wait(() => {
        const frame = app.captureCharFrame()
        return frame.includes("Resolving /slow-prompt") && frame.includes("hello world…")
      })
      const frame = app.captureCharFrame()
      expect(frame).toContain("Resolving /slow-prompt")
      expect(frame).toContain("hello world…")
    } finally {
      app.renderer.destroy()
    }
  }
})

async function mountProductionPrompt(input: {
  sessionID: string
  fetch?: FetchHandler
  width?: number
  height?: number
}) {
  const temporary = await tmpdir()
  await mkdir(path.join(temporary.path, "test", "locks"), { recursive: true })
  await Bun.write(path.join(temporary.path, "model.json"), JSON.stringify({}))
  await Bun.write(path.join(temporary.path, "session.json"), JSON.stringify({}))
  const events = createEventStream()

  const commands = [
    { name: "mcp-slow", description: "Slow MCP prompt" },
    { name: "mcp-fail", description: "Failing MCP prompt" },
    { name: "first-cmd", description: "First concurrent command" },
    { name: "second-cmd", description: "Second concurrent command" },
  ]

  const calls = createFetch(async (url, request) => {
    const response = await input.fetch?.(url, request)
    if (response) return response

    const location = { directory: url.searchParams.get("location[directory]") ?? directory }
    if (url.pathname === "/api/agent") return json({ location, data: [agent("build")] })
    if (url.pathname === "/api/model") return json({ location, data: [model("first")] })
    if (url.pathname === "/api/command") return json({ location, data: commands })
    if (url.pathname === `/api/session/${input.sessionID}`)
      return json({ data: session(input.sessionID, { providerID: "provider", id: "first" }) })
  }, events)

  let local!: ReturnType<typeof useLocal>
  let data!: ReturnType<typeof useData>
  let storage!: ReturnType<typeof useStorage>
  let promptRef!: PromptRef | undefined

  function Probe() {
    local = useLocal()
    data = useData()
    storage = useStorage()
    return null
  }

  function Harness() {
    return (
      <TestTuiContexts paths={{ state: temporary.path }}>
        <TuiAppProvider value={{ name: "test", version: "test", channel: "test" }}>
          <TuiLifecycleProvider value={{ add: () => () => {} }}>
            <ExitProvider exit={() => {}}>
              <StorageProvider>
                <ArgsProvider>
                  <ConfigProvider config={createTuiResolvedConfig({ animations: false })}>
                    <Keymap.Provider>
                      <ThemeProvider mode="dark" source={emptyThemeSource}>
                        <ToastProvider>
                          <RouteProvider initialRoute={{ type: "session", sessionID: input.sessionID }}>
                            <ClientProvider api={createApi(calls.fetch)}>
                              <DataProvider directory={directory}>
                                <LocationProvider>
                                  <PermissionProvider>
                                    <LocalProvider>
                                      <Probe />
                                      <SessionTabsProvider>
                                        <FrecencyProvider>
                                          <PromptHistoryProvider>
                                            <PromptStashProvider>
                                              <PromptRefProvider>
                                                <EditorContextProvider>
                                                  <DialogProvider>
                                                    <AttentionProvider>
                                                      <PluginProvider
                                                        packages={{ prepare: async () => ({}) as any }}
                                                        directories={[]}
                                                      >
                                                        <Prompt
                                                          sessionID={input.sessionID}
                                                          ref={(ref) => {
                                                            promptRef = ref
                                                          }}
                                                        />
                                                      </PluginProvider>
                                                    </AttentionProvider>
                                                  </DialogProvider>
                                                </EditorContextProvider>
                                              </PromptRefProvider>
                                            </PromptStashProvider>
                                          </PromptHistoryProvider>
                                        </FrecencyProvider>
                                      </SessionTabsProvider>
                                    </LocalProvider>
                                  </PermissionProvider>
                                </LocationProvider>
                              </DataProvider>
                            </ClientProvider>
                          </RouteProvider>
                        </ToastProvider>
                      </ThemeProvider>
                    </Keymap.Provider>
                  </ConfigProvider>
                </ArgsProvider>
              </StorageProvider>
            </ExitProvider>
          </TuiLifecycleProvider>
        </TuiAppProvider>
      </TestTuiContexts>
    )
  }

  const app = await testRender(() => <Harness />, {
    width: input.width ?? 100,
    height: input.height ?? 10,
    kittyKeyboard: true,
  })
  app.renderer.start()

  await wait(() => local !== undefined)
  await wait(() => local.model.ready)
  await wait(() => promptRef !== undefined)
  await data.location.sync()
  await data.session.sync(input.sessionID)

  return {
    app,
    get promptRef() {
      return promptRef!
    },
    data,
    temporary,
    async cleanup() {
      app.renderer.destroy()
      await storage?.flush().catch(() => {})
      await temporary[Symbol.asyncDispose]()
    },
  }
}

test("production Prompt shows pending state immediately on slash command submit and removes on resolve", async () => {
  PendingCommands.clear()
  const commandSettled = Promise.withResolvers<Response>()
  let commandCalled = false

  const harness = await mountProductionPrompt({
    sessionID: "ses_prompt_success",
    fetch: (url, request) => {
      if (url.pathname === "/api/session/ses_prompt_success/command" && request.method === "POST") {
        commandCalled = true
        return commandSettled.promise
      }
    },
  })

  try {
    await harness.app.renderOnce()
    const textarea = harness.app.renderer.currentFocusedEditor
    if (!(textarea instanceof TextareaRenderable)) throw new Error("expected focused prompt textarea")

    // Type slash command
    textarea.setText("/mcp-slow hello world")
    await harness.app.renderOnce()

    // Submit
    harness.app.mockInput.pressEnter()
    await wait(() => commandCalled)

    // Verify input cleared immediately
    expect(textarea.plainText).toBe("")

    // Verify pending command is in store and visible in TUI frame
    expect(PendingCommands.list("ses_prompt_success")).toHaveLength(1)
    expect(PendingCommands.list("ses_prompt_success")[0].name).toBe("mcp-slow")
    expect(PendingCommands.list("ses_prompt_success")[0].arguments).toBe("hello world")

    await harness.app.renderOnce()
    expect(harness.app.captureCharFrame()).toContain("Resolving /mcp-slow hello world…")

    // Resolve command
    commandSettled.resolve(json({ data: { ok: true } }))
    await wait(() => PendingCommands.list("ses_prompt_success").length === 0)

    // Verify pending indicator cleared
    await harness.app.renderOnce()
    expect(harness.app.captureCharFrame()).not.toContain("Resolving")
  } finally {
    await harness.cleanup()
  }
})

test("production Prompt shows pending state on failing command and restores draft if no newer input was typed", async () => {
  PendingCommands.clear()
  const commandSettled = Promise.withResolvers<Response>()
  let commandCalled = false

  const harness = await mountProductionPrompt({
    sessionID: "ses_prompt_fail",
    fetch: (url, request) => {
      if (url.pathname === "/api/session/ses_prompt_fail/command" && request.method === "POST") {
        commandCalled = true
        return commandSettled.promise
      }
    },
  })

  try {
    await harness.app.renderOnce()
    const textarea = harness.app.renderer.currentFocusedEditor
    if (!(textarea instanceof TextareaRenderable)) throw new Error("expected focused prompt textarea")

    // Type slash command
    textarea.setText("/mcp-fail test-args")
    await harness.app.renderOnce()

    // Submit
    harness.app.mockInput.pressEnter()
    await wait(() => commandCalled)

    // Verify pending state active
    expect(PendingCommands.list("ses_prompt_fail")).toHaveLength(1)
    await harness.app.renderOnce()
    expect(harness.app.captureCharFrame()).toContain("Resolving /mcp-fail test-args…")

    // Fail the command
    commandSettled.reject(new Error("MCP server timeout"))
    await wait(() => PendingCommands.list("ses_prompt_fail").length === 0)

    // Verify pending indicator cleared and composer restored draft
    await harness.app.renderOnce()
    expect(harness.app.captureCharFrame()).not.toContain("Resolving")
    expect(textarea.plainText).toBe("/mcp-fail test-args")
  } finally {
    await harness.cleanup()
  }
})

test("production Prompt preserves newly typed input when an in-flight command fails", async () => {
  PendingCommands.clear()
  const commandSettled = Promise.withResolvers<Response>()
  let commandCalled = false

  const harness = await mountProductionPrompt({
    sessionID: "ses_prompt_typing",
    fetch: (url, request) => {
      if (url.pathname === "/api/session/ses_prompt_typing/command" && request.method === "POST") {
        commandCalled = true
        return commandSettled.promise
      }
    },
  })

  try {
    await harness.app.renderOnce()
    const textarea = harness.app.renderer.currentFocusedEditor
    if (!(textarea instanceof TextareaRenderable)) throw new Error("expected focused prompt textarea")

    // Submit slow command
    textarea.setText("/mcp-slow old draft")
    await harness.app.renderOnce()
    harness.app.mockInput.pressEnter()
    await wait(() => commandCalled)

    // Composer was cleared; user types new text while command is in flight
    expect(textarea.plainText).toBe("")
    textarea.setText("brand new user message")
    await harness.app.renderOnce()

    // Command fails
    commandSettled.reject(new Error("MCP server error"))
    await wait(() => PendingCommands.list("ses_prompt_typing").length === 0)

    // Newly typed text is PRESERVED, not clobbered by old draft
    await harness.app.renderOnce()
    expect(textarea.plainText).toBe("brand new user message")
  } finally {
    await harness.cleanup()
  }
})

test("production Prompt handles multiple concurrent slash command submissions", async () => {
  PendingCommands.clear()
  const firstSettled = Promise.withResolvers<Response>()
  const secondSettled = Promise.withResolvers<Response>()
  const called: string[] = []

  const harness = await mountProductionPrompt({
    sessionID: "ses_prompt_multi",
    fetch: async (url, request) => {
      if (url.pathname === "/api/session/ses_prompt_multi/command" && request.method === "POST") {
        const body = (await request.json()) as { name: string }
        called.push(body.name)
        if (body.name === "first-cmd") return firstSettled.promise
        if (body.name === "second-cmd") return secondSettled.promise
      }
    },
  })

  try {
    await harness.app.renderOnce()
    const textarea = harness.app.renderer.currentFocusedEditor
    if (!(textarea instanceof TextareaRenderable)) throw new Error("expected focused prompt textarea")

    // Submit first command
    textarea.setText("/first-cmd foo")
    await harness.app.renderOnce()
    harness.app.mockInput.pressEnter()
    await wait(() => called.includes("first-cmd"))

    // Submit second command while first is in flight
    textarea.setText("/second-cmd bar")
    await harness.app.renderOnce()
    harness.app.mockInput.pressEnter()
    await wait(() => called.includes("second-cmd"))

    // Both are pending concurrently
    expect(PendingCommands.list("ses_prompt_multi")).toHaveLength(2)
    await harness.app.renderOnce()
    expect(harness.app.captureCharFrame()).toContain("Resolving /first-cmd foo (+1 more)…")

    // Resolve first command
    firstSettled.resolve(json({ data: { ok: true } }))
    await wait(() => PendingCommands.list("ses_prompt_multi").length === 1)

    // Second command is now the primary visible pending command
    await harness.app.renderOnce()
    expect(harness.app.captureCharFrame()).toContain("Resolving /second-cmd bar…")

    // Resolve second command
    secondSettled.resolve(json({ data: { ok: true } }))
    await wait(() => PendingCommands.list("ses_prompt_multi").length === 0)

    await harness.app.renderOnce()
    expect(harness.app.captureCharFrame()).not.toContain("Resolving")
  } finally {
    await harness.cleanup()
  }
})
