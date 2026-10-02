import fs from "node:fs/promises"
import path from "node:path"
import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { Environment } from "@opencode/core/environment/index"
import { FileAccess } from "@opencode/core/file-access"
import { Location } from "@opencode/core/location"
import { Permission } from "@opencode/core/permission"
import { AbsolutePath } from "@opencode/core/schema"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { location } from "./fixture/location"
import { withTempDir } from "./fixture/tmpdir"
import { it } from "./lib/effect"
import { permissionLayer } from "./lib/permission"

function provide(environment: Environment.Interface) {
  return Effect.provide(
    LayerNode.compile(FileAccess.node, {
      replacements: [
        Environment.node.replace(Layer.succeed(Environment.Service, Environment.Service.of(environment))),
        Permission.node.replace(permissionLayer()),
        Location.node.replace(
          Layer.succeed(
            Location.Service,
            Location.Service.of(location({ directory: AbsolutePath.make("/workspace") })),
          ),
        ),
      ],
    }),
  )
}

const slash = (value: string) => value.replaceAll("\\", "/")

describe("FileAccess.resolve environment isolation", () => {
  it.live("uses the environment file type and nearest repository rather than conflicting host paths", () =>
    withTempDir(({ path: host }) =>
      Effect.gen(function* () {
        const nested = path.join(host, "nested")
        const targetPath = path.join(nested, "target")
        yield* Effect.promise(async () => {
          await fs.mkdir(path.join(host, ".git"))
          await fs.mkdir(targetPath, { recursive: true })
        })
        const driver = Environment.makeMemoryDriver()
        const files = Environment.makeFiles(driver)
        yield* files.mkdir(path.join(nested, ".hg"))
        yield* files.write(targetPath, new Uint8Array())
        const target = yield* Effect.gen(function* () {
          const access = yield* FileAccess.Service
          return yield* access.resolve({ path: targetPath })
        }).pipe(provide({ files, spawner: driver.spawner }))

        expect(target.externalDirectory).toEqual({
          action: "external_directory",
          directory: AbsolutePath.make(nested),
          resource: slash(path.join(nested, "*")),
          save: slash(path.join(nested, "*")),
        })
      }),
    ),
  )

  it.live("recognizes environment directories and git worktree marker files despite host file collisions", () =>
    withTempDir(({ path: host }) =>
      Effect.gen(function* () {
        const targetPath = path.join(host, "target")
        yield* Effect.promise(() => fs.writeFile(targetPath, "host file"))
        const driver = Environment.makeMemoryDriver()
        const files = Environment.makeFiles(driver)
        yield* files.mkdir(targetPath)
        yield* files.write(path.join(host, ".git"), new TextEncoder().encode("gitdir: /remote/repository"))
        const target = yield* Effect.gen(function* () {
          const access = yield* FileAccess.Service
          return yield* access.resolve({ path: targetPath })
        }).pipe(provide({ files, spawner: driver.spawner }))

        expect(target.externalDirectory).toMatchObject({
          directory: targetPath,
          resource: slash(path.join(targetPath, "*")),
          save: slash(path.join(host, "*")),
        })
      }),
    ),
  )

  it.live("does not broaden saved permissions from a repository that exists only on the host", () =>
    withTempDir(({ path: host }) =>
      Effect.gen(function* () {
        yield* Effect.promise(() => fs.mkdir(path.join(host, ".git")))
        const driver = Environment.makeMemoryDriver()
        const files = Environment.makeFiles(driver)
        const directory = path.join(host, "remote-only", "nested")
        yield* files.mkdir(directory)
        const target = yield* Effect.gen(function* () {
          const access = yield* FileAccess.Service
          return yield* access.resolve({ path: path.join(directory, "new.txt") })
        }).pipe(provide({ files, spawner: driver.spawner }))

        expect(target.externalDirectory?.save).toBe(slash(path.join(directory, "*")))
      }),
    ),
  )

  for (const kind of ["directory", "file", "missing"] as const) {
    it.live(`follows an external ${kind} symlink when selecting its lexical permission boundary`, () =>
      Effect.gen(function* () {
        const driver = Environment.makeMemoryDriver()
        const files = Environment.makeFiles(driver)
        yield* files.mkdir("/outside")
        if (kind === "directory") yield* files.mkdir("/destination")
        if (kind === "file") yield* files.write("/destination", new Uint8Array())
        yield* driver.symlink("/destination", "/outside/link")
        const target = yield* Effect.gen(function* () {
          const access = yield* FileAccess.Service
          return yield* access.resolve({ path: "/outside/link" })
        }).pipe(provide({ files, spawner: driver.spawner }))

        expect(target.absolute).toBe(AbsolutePath.make("/outside/link"))
        expect(target.externalDirectory?.directory).toBe(
          AbsolutePath.make(kind === "directory" ? "/outside/link" : "/outside"),
        )
        expect(target.externalDirectory?.resource).toBe(kind === "directory" ? "/outside/link/*" : "/outside/*")
      }),
    )
  }

  it.live("keeps explicit kind hints and prospective targets independent of environment entry types", () =>
    Effect.gen(function* () {
      const driver = Environment.makeMemoryDriver()
      const files = Environment.makeFiles(driver)
      yield* files.mkdir("/outside/directory")
      const targets = yield* Effect.gen(function* () {
        const access = yield* FileAccess.Service
        return yield* Effect.all([
          access.resolve({ path: "/outside/directory", kind: "file" }),
          access.resolve({ path: "/outside/missing", kind: "directory" }),
          access.resolve({ path: "/outside/new/nested/file" }),
        ])
      }).pipe(provide({ files, spawner: driver.spawner }))

      expect(targets.map((target) => target.externalDirectory?.directory)).toEqual([
        AbsolutePath.make("/outside"),
        AbsolutePath.make("/outside/missing"),
        AbsolutePath.make("/outside/new/nested"),
      ])
    }),
  )

  it.live("keeps permission resources lexical when environment probes fail", () =>
    Effect.gen(function* () {
      const driver = Environment.makeMemoryDriver()
      const files = {
        ...Environment.makeFiles(driver),
        stat: (target: string) =>
          Effect.fail(new Environment.Failed({ path: target, cause: new Error("unavailable") })),
      }
      const target = yield* Effect.gen(function* () {
        const access = yield* FileAccess.Service
        return yield* access.resolve({ path: "/outside/nested/file" })
      }).pipe(provide({ files, spawner: driver.spawner }))

      expect(target.externalDirectory).toEqual({
        action: "external_directory",
        directory: AbsolutePath.make("/outside/nested"),
        resource: "/outside/nested/*",
        save: "/outside/nested/*",
      })
    }),
  )
})
