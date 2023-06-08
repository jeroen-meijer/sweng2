import {
  Fun,
  abs,
  decr,
  equals,
  id,
  ifThen,
  incr,
  isPositive,
  safeSqrt,
  sqrt,
} from "../src/index";
import { mainLogger } from "../src/logger";
import { Err, Ok, Unit } from "../src/utilityTypes";

describe("utility types", () => {
  describe("Unit", () => {
    test("has a single valid value with no fields", () => {
      const unit: Unit = {};

      expect(Object.entries(unit).length).toStrictEqual(0);
    });
  });

  describe("Result", () => {
    describe("Ok", () => {
      test("has correct kind", () => {
        expect(Ok(1).kind).toStrictEqual("ok");
      });

      test("contains value", () => {
        expect(Ok(1).value).toStrictEqual(1);
      });
    });

    describe("Err", () => {
      test("has correct kind", () => {
        expect(Err("something").kind).toStrictEqual("err");
      });

      test("contains value", () => {
        expect(Err("something").value).toStrictEqual("something");
      });
    });
  });
});
