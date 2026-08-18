// Inclusion and validation rules for the cable plan, run against the
// real system definitions so a data edit that breaks the schedule
// fails here first.

import { describe, it, expect } from "vitest"
import {
  buildInitialState, buildInclusionMap, validateConfiguration,
  flattenComponents, isMandatoryForSystem,
} from "../cablePlanSpec"
import single from "../../data/cable-systems/ets64r-single-leaf.json"
import double from "../../data/cable-systems/ets64r-double-leaf.json"

describe.each([["single", single], ["double", double]])("%s-leaf system", (_name, system) => {
  it("every component has a drawing anchor", () => {
    for (const { comp } of flattenComponents(system)) {
      expect(system.drawing.anchors[comp.id], `anchor for ${comp.id}`).toBeTruthy()
    }
  })

  it("the prepared plan is valid as it starts", () => {
    const state = buildInitialState(system)
    expect(validateConfiguration(system, state).isValid).toBe(true)
  })

  it("the release button is mandatory on a fire door", () => {
    const comp = system.components.find(c => c.id === "comp-9")
    expect(isMandatoryForSystem(comp, system)).toBe(true)
  })

  it("an 'other' cable with no type is a blocking error", () => {
    const state = buildInitialState(system)
    state["comp-2"] = { ...state["comp-2"], isOther: true, otherValue: "" }
    const v = validateConfiguration(system, state)
    expect(v.isValid).toBe(false)
    expect(v.errors.some(e => e.id === "comp-2")).toBe(true)
  })

  it("a sub-component only counts when its parent is included", () => {
    const state = buildInitialState(system)
    state["comp-6"] = { ...state["comp-6"], included: false }
    state["comp-6-1"] = { ...state["comp-6-1"], included: true }
    const map = buildInclusionMap(system, state)
    expect(map["comp-6-1"]).toBe(false)
  })
})

describe("double-leaf additions", () => {
  it("carries the closing sequence controller as mandatory at position 10", () => {
    const comp = double.components.find(c => c.position === "10")
    expect(comp).toBeTruthy()
    expect(comp.mandatory).toBe(true)
  })

  it("carries sensor strips on both leaves", () => {
    const flat = flattenComponents(double).map(f => f.comp.position)
    expect(flat).toContain("5.1")
    expect(flat).toContain("5.2")
  })

  it("draws two leaves with one active", () => {
    expect(double.drawing.geo.leaves).toHaveLength(2)
    expect(double.drawing.geo.leaves.filter(l => l.active)).toHaveLength(1)
  })
})
