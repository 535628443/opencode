import type { OpenCodeClient, OpenCodeEvent, SessionInfo, SessionActiveOutput } from "../src/promise/index.js"
import type { createData } from "../src/solid/data.js"
import type { Session } from "@opencode/schema/session"
import type { SessionMessage } from "@opencode/schema/session-message"
import type { ProjectID } from "@opencode/schema/project-id"

type Assert<T extends true> = T
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

type GetInput = Parameters<OpenCodeClient["session"]["get"]>[0]
type GetOutput = Awaited<ReturnType<OpenCodeClient["session"]["get"]>>
type Created = Extract<OpenCodeEvent, { type: "session.created" }>
type Data = ReturnType<typeof createData>
type Create = Parameters<Data["session"]["create"]>[0]
// Output branding must not indirectly narrow the staged public string inputs.
export type OutputSession = Assert<Equal<GetOutput["id"], Session.ID>>
export type RejectOutputMessage = Assert<SessionMessage.ID extends GetOutput["id"] ? false : true>
export type NestedSession = Assert<Equal<Created["data"]["sessionID"], Session.ID>>
export type NestedProject = Assert<Equal<Created["data"]["projectID"], ProjectID>>
export type DatesRemainWire = Assert<Equal<SessionInfo["time"]["created"], number>>
export type ActiveKeys = Assert<Equal<keyof SessionActiveOutput, Session.ID>>
export type AcceptHttpSession = Assert<string extends GetInput["sessionID"] ? true : false>
export type AcceptDataSession = Assert<string extends Parameters<Data["session"]["get"]>[0] ? true : false>
export type AcceptDataModel = Assert<string extends NonNullable<Create["model"]>["id"] ? true : false>
export type AcceptDataProvider = Assert<string extends NonNullable<Create["model"]>["providerID"] ? true : false>
export type AcceptDataLocation = Assert<{ directory: string; workspaceID: string } extends NonNullable<Create["location"]> ? true : false>
export type AcceptNullPrompt = Assert<null extends Parameters<OpenCodeClient["session"]["prompt"]>[0]["id"] ? true : false>
