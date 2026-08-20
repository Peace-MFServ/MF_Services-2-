// Inclusion and validation rules for the cable plan, run against the
// real system definitions so a data edit that breaks the schedule
// fails here first. The position lists are asserted against the
// manufacturer's ETS 73 cable diagram sheets — position for position.

import { describe, it, expect } from "vitest"
import {
  buildInitialState, buildInclusionMap, validateConfiguration,
  flattenComponents, isMandatoryForSystem, CABLE_TYPES,
} from "../cablePlanSpec"
import single from "../../data/cable-systems/ets73-single-leaf.json"
import double from "../../data/cable-systems/ets73-double-leaf.json"

describe.each([
  ["single", single, { parent: "comp-6", child: "comp-6-1" }],
  ["double", double, { parent: "comp-12", child: "comp-12-1" }],
])("%s-leaf system", (_name, system, sub) => {
  it("is named ETS 73", () => {
    expect(system.name).toBe("ETS 73")
  })

  it("every component has a drawing anchor", () => {
    for (const { comp } of flattenComponents(system)) {
      expect(system.drawing.anchors[comp.id], `anchor for ${comp.id}`).toBeTruthy()
    }
  })

  it("every default cable is in the legend or explicitly integrated", () => {
    for (const { comp } of flattenComponents(system)) {
      expect(CABLE_TYPES[comp.cable.defaultCable], `cable for ${comp.id}`).toBeTruthy()
    }
  })

  it("the prepared plan is valid as it starts", () => {
    const state = buildInitialState(system)
    expect(validateConfiguration(system, state).isValid).toBe(true)
  })

  it("only power is mandatory — everything else is optional", () => {
    for (const { comp } of flattenComponents(system)) {
      expect(isMandatoryForSystem(comp, system), `mandatory for ${comp.id}`)
        .toBe(comp.type === "power_supply")
    }
  })

  it("the prepared plan starts with power only", () => {
    const state = buildInitialState(system)
    const map = buildInclusionMap(system, state)
    const included = flattenComponents(system).filter(f => map[f.comp.id])
    expect(included.every(f => f.comp.type === "power_supply")).toBe(true)
    expect(included.length).toBeGreaterThan(0)
  })

  it("an 'other' cable with no type is a blocking error", () => {
    const state = buildInitialState(system)
    state["comp-2"] = { ...state["comp-2"], included: true, isOther: true, otherValue: "" }
    const v = validateConfiguration(system, state)
    expect(v.isValid).toBe(false)
    expect(v.errors.some(e => e.id === "comp-2")).toBe(true)
  })

  it("a sub-component only counts when its parent is included", () => {
    const state = buildInitialState(system)
    state[sub.parent] = { ...state[sub.parent], included: false }
    state[sub.child] = { ...state[sub.child], included: true }
    const map = buildInclusionMap(system, state)
    expect(map[sub.child]).toBe(false)
  })
})

describe("ETS 73 single-leaf sheet fidelity", () => {
  it("carries exactly the sheet's positions", () => {
    const positions = flattenComponents(single).map(f => f.comp.position)
    expect(positions).toEqual(["1", "2", "3", "4", "5.1", "6", "6.1", "7", "7.1", "8", "9"])
  })

  it("position 9 is the alternative operating element", () => {
    const comp = single.components.find(c => c.position === "9")
    expect(comp.label).toBe("Alternative operating element")
    expect(comp.cable.defaultCable).toBe("J-Y(ST)Y 4 x 0.8 mm²")
  })

  it("has no Flatscan and no smoke detectors", () => {
    const types = flattenComponents(single).map(f => f.comp.type)
    expect(types).not.toContain("smoke_detector")
    const labels = flattenComponents(single).map(f => f.comp.label)
    expect(labels.some(l => /flatscan/i.test(l))).toBe(false)
  })
})

describe("ETS 73 double-leaf sheet fidelity", () => {
  it("carries exactly the sheet's positions", () => {
    const positions = flattenComponents(double).map(f => f.comp.position)
    expect(positions).toEqual([
      "1", "2", "3", "3.1", "4", "5", "6", "7", "8", "9",
      "10", "11", "12", "12.1", "13", "13.1", "14", "15",
    ])
  })

  it("the door coordinator at 3.1 is optional", () => {
    const comp = double.components.find(c => c.position === "3.1")
    expect(comp.optional).toBe(true)
    expect(isMandatoryForSystem(comp, double)).toBe(false)
  })

  it("both power positions are mandatory — one motor per leaf", () => {
    for (const pos of ["1", "2"]) {
      const comp = double.components.find(c => c.position === pos)
      expect(isMandatoryForSystem(comp, double)).toBe(true)
    }
  })

  it("position 9 uses the E-opener cable from the sheet legend", () => {
    const comp = double.components.find(c => c.position === "9")
    expect(comp.cable.defaultCable).toBe("With 4 x 0.6 mm² E-opener")
  })

  it("draws two leaves with one active", () => {
    expect(double.drawing.geo.leaves).toHaveLength(2)
    expect(double.drawing.geo.leaves.filter(l => l.active)).toHaveLength(1)
  })
})
