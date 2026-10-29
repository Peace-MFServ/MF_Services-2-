// The admin's view of everyone's projects rests on two things: one
// account carries an admin flag nobody can give themselves, and the
// rules let that account alone read every project. The rules run on
// Google's servers, so these checks read the rules file itself — a
// change that drops either guard fails here before it is published.

import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { projectType } from "../projects"

const rules = readFileSync(join(process.cwd(), "firestore.rules"), "utf8")
/** One collection's rules: from its match line to the next match. */
const block = name => {
  const start = rules.indexOf(`match /${name}/`)
  const next = rules.indexOf("match /", start + 1)
  return rules.slice(start, next === -1 ? undefined : next)
}

describe("admin access", () => {
  it("lets nobody give themselves the admin flag", () => {
    const users = block("users")
    expect(users).toMatch(/allow create:[^;]*!\('admin' in request\.resource\.data\)/)
    expect(users).toMatch(/allow update:[^;]*request\.resource\.data\.get\('admin', false\) == resource\.data\.get\('admin', false\)/)
  })

  it("lets the owner and the admin alone read a project", () => {
    expect(block("projects")).toMatch(/allow read: if isOwner\(resource\.data\.ownerId\) \|\| isAdmin\(\);/)
  })

  it("lets only the owner change or delete a project", () => {
    const projects = block("projects")
    expect(projects).toMatch(/allow update: if isOwner\(resource\.data\.ownerId\)/)
    expect(projects).toMatch(/allow delete: if isOwner\(resource\.data\.ownerId\);/)
  })
})

describe("project types", () => {
  it("names each kind of saved work", () => {
    expect(projectType({ kind: "quote", selectionId: "pricer" })).toBe("Quote")
    expect(projectType({ kind: "cable", selectionId: "ets73-single" })).toBe("Cable plan")
    expect(projectType({ kind: "door", selectionId: "steel-doors" })).toBe("Steel doors")
    expect(projectType({ kind: "door", selectionId: "riser-doors" })).toBe("Riser doors")
  })
})
