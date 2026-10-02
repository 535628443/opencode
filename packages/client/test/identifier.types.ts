import type { Effect } from "effect"
import type { Session, SessionMessage, SessionApi } from "../src/effect/index.js"

type Assert<T extends true> = T
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type GetInput = Parameters<SessionApi["get"]>[0]
type RevertInput = Parameters<SessionApi["revert"]["stage"]>[0]
type GetOutput = Effect.Success<ReturnType<SessionApi["get"]>>

// Compile against the public client and the generated API. A lost brand must fail
// package typecheck even though branded strings serialize identically over HTTP.
type SessionInput = Assert<Equal<GetInput["sessionID"], Session.ID>>
type SessionOutput = Assert<Equal<GetOutput["id"], Session.ID>>
type MessageInput = Assert<Equal<RevertInput["messageID"], SessionMessage.ID>>
type RejectMessageAsSession = Assert<SessionMessage.ID extends GetInput["sessionID"] ? false : true>
type RejectSessionAsMessage = Assert<Session.ID extends RevertInput["messageID"] ? false : true>
type RejectPlainSession = Assert<string extends GetInput["sessionID"] ? false : true>
type RejectPlainMessage = Assert<string extends RevertInput["messageID"] ? false : true>
