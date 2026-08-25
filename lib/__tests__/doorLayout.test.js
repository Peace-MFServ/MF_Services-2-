// A multi-leaf riser is a row of door sets — pairs meeting at a
// mullion — not a row of independently hung leaves. These lock that in
// so the elevation and the PDF can never drift apart from it.

import { describe, it, expect } from "vitest"
import { leafLayout, describeSets } from "../doorLayout"

const sizes = (leaves, handing) => leafLayout(leaves, handing).sets.map(s => s.count)

describe("door sets", () => {
  it("pairs the leaves — six leaves are three double doorsets", () => {
    expect(sizes(6, "left")).toEqual([2, 2, 2])
    expect(sizes(4, "left")).toEqual([2, 2])
    expect(sizes(2, "left")).toEqual([2])
  })

  it("a single leaf is one set", () => {
    expect(sizes(1, "left")).toEqual([1])
    expect(leafLayout(1, "left").boundaries).toEqual([])
  })

  it("odd counts carry one single leaf, away from the handing side", () => {
    expect(sizes(3, "left")).toEqual([2, 1])
    expect(sizes(3, "right")).toEqual([1, 2])
    expect(sizes(5, "left")).toEqual([2, 2, 1])
    expect(sizes(5, "right")).toEqual([1, 2, 2])
  })

  it("marks a mullion between each pair of adjacent sets", () => {
    expect(leafLayout(6, "left").boundaries).toEqual([2, 4])
    expect(leafLayout(2, "left").boundaries).toEqual([])
  })
})

describe("leaf hardware", () => {
  it("gives each set exactly one active leaf — one handle per door", () => {
    for (const leaves of [1, 2, 3, 4, 5, 6]) {
      const { sets, leaves: info } = leafLayout(leaves, "left")
      for (let s = 0; s < sets.length; s++) {
        const inSet = info.filter(l => l.set === s)
        expect(inSet.filter(l => l.isActive), `set ${s} of ${leaves}`).toHaveLength(1)
      }
    }
  })

  it("pivots each pair at its outer edges, meeting in the middle", () => {
    const { leaves } = leafLayout(4, "left")
    expect(leaves.map(l => l.pivotSide)).toEqual(["left", "right", "left", "right"])
  })

  it("pivots a single leaf on the handing side", () => {
    expect(leafLayout(1, "left").leaves[0].pivotSide).toBe("left")
    expect(leafLayout(1, "right").leaves[0].pivotSide).toBe("right")
  })

  it("handing decides which leaf of a pair is active", () => {
    expect(leafLayout(2, "left").leaves.find(l => l.isActive).index).toBe(0)
    expect(leafLayout(2, "right").leaves.find(l => l.isActive).index).toBe(1)
  })

  it("every leaf is either active or passive", () => {
    for (const l of leafLayout(6, "right").leaves) {
      expect(l.isActive).toBe(!l.isPassive)
    }
  })
})

describe("describing the sets", () => {
  it("reads as the doorsets a fitter would recognise", () => {
    expect(describeSets(6, "left")).toBe("3 × double")
    expect(describeSets(5, "left")).toBe("2 × double + 1 × single")
    expect(describeSets(1, "left")).toBe("1 × single")
  })
})
