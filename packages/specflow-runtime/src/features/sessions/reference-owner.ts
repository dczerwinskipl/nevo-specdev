/** Identity facts supplied by the Session owner; never inferred from a Task URL. */
export interface SessionReferenceOwner {
  resolve(
    sessionId: string,
  ): Promise<{ sessionId: string; specId: string; projectId: string; workspaceId: string } | null>;
}
