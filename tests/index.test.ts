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
import { Err, Ok } from "../src/utilityTypes";

describe("operations", () => {
  describe("Fun", () => {
    test("wraps a function", () => {
      const f = (x: number) => x + 1;
      expect(Fun(f)(0)).toStrictEqual(1);
      expect(Fun(f)(100)).toStrictEqual(101);
      expect(Fun(f)(-1)).toStrictEqual(0);
    });

    describe(".then", () => {
      test("composes following function", () => {
        const f = (x: number) => x + 1;
        const g = (x: number) => x * 2;
        expect(Fun(f).then(Fun(g))(0)).toStrictEqual(2);
        expect(Fun(f).then(Fun(g))(100)).toStrictEqual(202);
        expect(Fun(f).then(Fun(g))(-1)).toStrictEqual(0);
      });
    });

    describe("when symmetrically typed", () => {
      describe(".repeat", () => {
        test("repeats the given function the amount of times provided", () => {
          const incr = Fun((x: number) => x + 1);
          const plusThree = incr.repeat(3);

          expect(plusThree(0)).toStrictEqual(3);
        });
      });

      describe(".repeatUntil", () => {
        test("repeats the given function until the condition is met", () => {
          const incr = Fun((x: number) => x + 1);
          const incrUntil10OrHigher = incr.repeatUntil(Fun((x) => x >= 10));

          expect(incrUntil10OrHigher(0)).toStrictEqual(10);
          expect(incrUntil10OrHigher(15)).toStrictEqual(15);
        });
      });
    });
  });

  describe("id", () => {
    test("does nothing with its value", () => {
      expect(id()(0)).toStrictEqual(0);
      expect(id()(100)).toStrictEqual(100);
      expect(id()("test")).toStrictEqual("test");
    });
  });

  describe("equals", () => {
    test("performs equality check", () => {
      expect(equals(0)(0)).toStrictEqual(true);
      expect(equals(0)(100)).toStrictEqual(false);
      expect(equals("a")("a")).toStrictEqual(true);
      expect(equals("a")("b")).toStrictEqual(false);
    });
  });

  describe("incr", () => {
    test("increments a number", () => {
      expect(incr(0)).toStrictEqual(1);
      expect(incr(100)).toStrictEqual(101);
      expect(incr(-1)).toStrictEqual(0);
    });
  });

  describe("decr", () => {
    test("decrements a number", () => {
      expect(decr(0)).toStrictEqual(-1);
      expect(decr(100)).toStrictEqual(99);
      expect(decr(-1)).toStrictEqual(-2);
    });
  });

  describe("isPositive", () => {
    test("returns true if number is greater than or equal to zero", () => {
      expect(isPositive(0)).toStrictEqual(true);
      expect(isPositive(100)).toStrictEqual(true);
    });

    test("returns false if number is less than zero", () => {
      expect(isPositive(-1)).toStrictEqual(false);
    });
  });

  describe("safeSqrt", () => {
    test("returns square root of positive number", () => {
      expect(safeSqrt(4)).toStrictEqual(2);
      expect(safeSqrt(100)).toStrictEqual(10);
    });

    test("inverts negative number, then returns square root", () => {
      expect(safeSqrt(-4)).toStrictEqual(2);
      expect(safeSqrt(-100)).toStrictEqual(10);
      expect(safeSqrt(0)).toStrictEqual(0);
    });
  });

  describe("sqrt", () => {
    test("returns Ok with square root of positive number", () => {
      expect(sqrt(4)).toStrictEqual(Ok(2));
      expect(sqrt(100)).toStrictEqual(Ok(10));
    });

    test("returns Err with error message if number is negative", () => {
      expect(sqrt(-4)).toStrictEqual(
        Err("Cannot take square root of negative number")
      );
      expect(sqrt(-100)).toStrictEqual(
        Err("Cannot take square root of negative number")
      );
    });
  });

  describe("abs", () => {
    test("returns absolute value of number", () => {
      expect(abs(4)).toStrictEqual(4);
      expect(abs(-4)).toStrictEqual(4);
    });
  });

  describe("ifThen", () => {
    const inputA = "a";
    const inputB = "b";
    const conditionFn = Fun((x: string) => x === inputA);

    const outputA = "outputA";
    const outputB = "outputB";
    const thenFn = Fun((_: string) => outputA);
    const elseFn = Fun((_: string) => outputB);

    test("runs then-case if condition fn returns true", () => {
      expect(ifThen(conditionFn, thenFn, elseFn)(inputA)).toStrictEqual(
        outputA
      );
    });

    test("runs else-case if condition fn returns false", () => {
      expect(ifThen(conditionFn, thenFn, elseFn)(inputB)).toStrictEqual(
        outputB
      );
    });
  });
});
