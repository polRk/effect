import * as AST from "@effect/schema/AST"
import * as S from "@effect/schema/Schema"
import * as Util from "@effect/schema/test/TestUtils"
import { assert, describe, expect, it } from "vitest"

describe("brand", () => {
  describe("annotations", () => {
    it("toString / format", () => {
      const schema = S.Number.pipe(S.brand("A"))
      expect(String(schema)).toBe(`number & Brand<"A">`)
      expect(S.format(schema)).toBe(`number & Brand<"A">`)
    })

    it("using .annotations() twice", () => {
      const schema = S.Number.pipe(S.brand("A"))
      const annotatedSchema = schema.annotations({
        description: "description"
      }).annotations({ title: "title" })
      expect(annotatedSchema.ast.annotations).toEqual({
        [AST.BrandAnnotationId]: ["A"],
        [AST.TitleAnnotationId]: "title",
        [AST.DescriptionAnnotationId]: "description"
      })
    })

    it("using .annotations() on a BrandSchema should return a BrandSchema", () => {
      const schema = S.Number.pipe(
        S.int(),
        S.brand("A")
      )
      const annotatedSchema = schema.annotations({
        description: "description"
      }).annotations({ title: "title" })
      expect(typeof annotatedSchema).toBe("function")
    })

    it("brand as string (1 brand)", () => {
      // const Branded: S.BrandSchema<number & Brand<"A">, number, never>
      const schema = S.Number.pipe(
        S.int(),
        S.brand("A", {
          description: "an A brand"
        })
      )

      expect(schema.ast.annotations).toEqual({
        [AST.TypeAnnotationId]: S.IntTypeId,
        [AST.BrandAnnotationId]: ["A"],
        [AST.TitleAnnotationId]: `integer & Brand<"A">`,
        [AST.DescriptionAnnotationId]: "an A brand",
        [AST.JSONSchemaAnnotationId]: { type: "integer" }
      })
    })

    it("brand as string (2 brands)", () => {
      // const Branded: S.Schema<number, number & Brand<"A"> & Brand<"B">>
      const schema = S.Number.pipe(
        S.int(),
        S.brand("A"),
        S.brand("B", {
          description: "a B brand"
        })
      )

      expect(schema.ast.annotations).toEqual({
        [AST.TypeAnnotationId]: S.IntTypeId,
        [AST.BrandAnnotationId]: ["A", "B"],
        [AST.TitleAnnotationId]: `integer & Brand<"A"> & Brand<"B">`,
        [AST.DescriptionAnnotationId]: "a B brand",
        [AST.JSONSchemaAnnotationId]: { type: "integer" }
      })
    })

    it("brand as symbol", () => {
      const A = Symbol.for("A")
      const B = Symbol.for("B")
      // const Branded: S.Schema<number, number & Brand<unique symbol> & Brand<unique symbol>>
      const schema = S.Number.pipe(
        S.int(),
        S.brand(A),
        S.brand(B, {
          description: "a B brand"
        })
      )
      expect(schema.ast.annotations).toEqual({
        [AST.TypeAnnotationId]: S.IntTypeId,
        [AST.BrandAnnotationId]: [A, B],
        [AST.TitleAnnotationId]: "integer & Brand<Symbol(A)> & Brand<Symbol(B)>",
        [AST.DescriptionAnnotationId]: "a B brand",
        [AST.JSONSchemaAnnotationId]: { type: "integer" }
      })
    })
  })

  it("the constructor should throw on invalid values", () => {
    const IntegerFromString = S.NumberFromString.pipe(
      S.int({ identifier: "IntegerFromString" }),
      S.brand("Int")
    )
    expect(IntegerFromString(1)).toEqual(1)
    try {
      IntegerFromString(1.1)
      assert.fail("expected `IntegerFromString(1.1)` to throw an error")
    } catch (e: any) {
      expect(e.message).toStrictEqual(`IntegerFromString
└─ Predicate refinement failure
   └─ Expected IntegerFromString (an integer), actual 1.1`)
    }
  })

  it("composition", () => {
    const int = <A extends number, I>(self: S.Schema<A, I>) => self.pipe(S.int(), S.brand("Int"))

    const positive = <A extends number, I>(self: S.Schema<A, I>) => self.pipe(S.positive(), S.brand("Positive"))

    const PositiveInt = S.NumberFromString.pipe(int, positive)

    const is = S.is(PositiveInt)
    expect(is(1)).toEqual(true)
    expect(is(-1)).toEqual(false)
    expect(is(1.2)).toEqual(false)
  })

  describe("decoding", () => {
    it("string brand", async () => {
      const schema = S.NumberFromString.pipe(
        S.int(),
        S.brand("Int")
      ).annotations({ identifier: "IntegerFromString" })
      await Util.expectDecodeUnknownSuccess(schema, "1", 1 as any)
      await Util.expectDecodeUnknownFailure(
        schema,
        null,
        `IntegerFromString
└─ From side refinement failure
   └─ NumberFromString
      └─ Encoded side transformation failure
         └─ Expected a string, actual null`
      )
    })

    it("symbol brand", async () => {
      const Int = Symbol.for("Int")
      const schema = S.NumberFromString.pipe(
        S.int(),
        S.brand(Int)
      ).annotations({ identifier: "IntegerFromString" })
      await Util.expectDecodeUnknownSuccess(schema, "1", 1 as any)
      await Util.expectDecodeUnknownFailure(
        schema,
        null,
        `IntegerFromString
└─ From side refinement failure
   └─ NumberFromString
      └─ Encoded side transformation failure
         └─ Expected a string, actual null`
      )
    })
  })
})
