import { mainLogger } from "./logger";
import { Err, Ok, Result, Unit, unwrapResult } from "./utilityTypes";

export type Fun<a, b> = {
  (_: a): b;
  then: <c>(g: Fun<b, c>) => Fun<a, c>;
} & (a extends b ? SymmetricallyTypedFun<a> : Unit);

export type SymmetricallyTypedFun<a> = {
  repeat: (times: number) => Fun<a, a>;
  repeatUntil: (conditionFn: Fun<a, boolean>) => Fun<a, a>;
};

export const Fun = function <a, b>(f: (_: a) => b): Fun<a, b> {
  const fn = f as Fun<a, b>;
  fn.then = function <c>(this: Fun<a, b>, g: Fun<b, c>): Fun<a, c> {
    return then(this, g);
  };

  (fn as unknown as SymmetricallyTypedFun<Unit>).repeat = function (
    this: Fun<Unit, Unit>,
    times: number
  ) {
    return repeat(this, times);
  };

  (fn as unknown as SymmetricallyTypedFun<Unit>).repeatUntil = function (
    this: Fun<Unit, Unit>,
    conditionFn: Fun<Unit, boolean>
  ) {
    return repeatUntil(this, conditionFn);
  };

  return fn;
};

export const id = <a>() => Fun((x: a) => x);
export const equals = <a>(y: a) => Fun((x: a) => x == y);
export const ifThen = <a, b>(
  conditionFn: Fun<a, boolean>,
  thenFn: Fun<a, b>,
  elseFn: Fun<a, b>
): Fun<a, b> => Fun((x: a) => (conditionFn(x) ? thenFn : elseFn)(x));

const then = <a, b, c>(f: Fun<a, b>, g: Fun<b, c>): Fun<a, c> =>
  Fun((x) => g(f(x)));
const repeat = <a>(f: Fun<a, a>, times: number): Fun<a, a> =>
  times <= 0 ? id() : f.then(repeat(f, times - 1));
const repeatUntil = <a>(
  f: Fun<a, a>,
  conditionFn: Fun<a, boolean>
): Fun<a, a> =>
  Fun((x) => ifThen(conditionFn, id(), f.then(repeatUntil(f, conditionFn)))(x));

export const incr = Fun((x: number) => x + 1);
export const decr = Fun((x: number) => x - 1);
export const isPositive = Fun((a: number) => a >= 0);

export const sqrt: Fun<number, Result<number, string>> = ifThen(
  isPositive,
  Fun((x) => Ok(Math.sqrt(x))),
  Fun(() => Err("Cannot take square root of negative number"))
);
export const abs = Fun((a: number) => Math.abs(a));
export const safeSqrt = abs.then(sqrt).then(unwrapResult());

export const logObject = <a>(msg?: string) =>
  Fun((x: a) => {
    if (!!msg) {
      mainLogger.info(msg, x);
    } else {
      mainLogger.info(msg, x);
    }

    return x;
  });

// --- Lecture 2 Exercise 1 ---

type List<a> =
  | {
      kind: "cons";
      head: a;
      tail: List<a>;
    }
  | { kind: "empty" };

const Cons = <a>(head: a, tail: List<a>): List<a> => ({
  kind: "cons",
  head,
  tail,
});
const Empty = <a>(): List<a> => ({ kind: "empty" });

const arrayToList: <a>() => Fun<a[], List<a>> = <a>() =>
  Fun((a: a[]) =>
    a.length === 0 ? Empty() : Cons(a[0], arrayToList<a>()(a.slice(1)))
  );

const mapList = <a, b>(f: Fun<a, b>): Fun<List<a>, List<b>> =>
  Fun((l: List<a>) =>
    l.kind == "empty" ? Empty() : Cons(f(l.head), mapList(f)(l.tail))
  );

const splitChars: Fun<string, List<string>> = Fun((s: string) =>
  s.length === 0 ? Empty() : Cons(s.charAt(0), splitChars(s.slice(1)))
);

const joinStringSequence: Fun<List<string>, string> = Fun((l) =>
  l.kind === "empty" ? "" : l.head.concat(joinStringSequence(l.tail))
);

const splitMapJoinStrings = (f: Fun<List<string>, List<string>>) =>
  splitChars.then(f).then(joinStringSequence);

const encodeByOne: Fun<List<string>, List<string>> = mapList(
  Fun((s) => String.fromCharCode(s.charCodeAt(0) + 1))
);

const encode: Fun<number, Fun<List<string>, List<string>>> = Fun((n) =>
  mapList<string, string>(Fun((s) => String.fromCharCode(s.charCodeAt(0) + n)))
);

const listToString: <a>(toStr: Fun<a, string>) => Fun<List<a>, string> = <a>(
  toStr: Fun<a, string>
) =>
  Fun((l: List<a>) =>
    l.kind === "empty"
      ? "[EMPTY]"
      : l.tail.kind === "empty"
      ? `${toStr(l.head)}`
      : `${toStr(l.head)} => ${listToString(toStr)(l.tail)}`
  );

// --- Lecture 2 Exercise 2 ---

// (Already implemented as Result<t, e>)

// --- Lecture 2 Exercise 3 ---

type Tile<a> = {
  value: a;
  kind: "terrain" | "town" | "army";
};

const Terrain = <a>(value: a): Tile<a> => ({
  value,
  kind: "terrain",
});
const Town = <a>(value: a): Tile<a> => ({
  value,
  kind: "town",
});
const Army = <a>(value: a): Tile<a> => ({
  value,
  kind: "army",
});

const tileToString: <a>() => Fun<Tile<a>, string> = <a>() =>
  Fun((t: Tile<a>) => {
    switch (t.kind) {
      case "terrain":
        return `Terrain(${t.value})`;
      case "town":
        return `Town(${t.value})`;
      case "army":
        return `Army(${t.value})`;
    }
  });

const tileConvertToTown = <a>() =>
  Fun<Tile<a>, Tile<a>>((t) =>
    t.kind !== "terrain"
      ? {
          ...t,
        }
      : {
          ...t,
          kind: "town",
        }
  );

const tileDestroy = <a>() =>
  Fun<Tile<a>, Tile<a>>((t) => ({ ...t, kind: "terrain" }));

const tileMoveArmy = <a>() =>
  Fun<Tile<a>, Tile<a>>((t) =>
    t.kind !== "terrain" ? { ...t } : { ...t, kind: "army" }
  );

const mapTileList: <a>(
  f: Fun<Tile<a>, Tile<a>>
) => Fun<List<Tile<a>>, List<Tile<a>>> = <a>(f: Fun<Tile<a>, Tile<a>>) =>
  mapList(f);

const tileListToString = <a>() => listToString(tileToString<a>());

// mainLogger.info(
//   arrayToList<Tile<number>>().then(
//     Fun<List<Tile<number>>, Record<string, string>>((l) => {
//       return {
//         before: tileListToString()(l),

//         afterConvertToTown: mapTileList(tileConvertToTown<number>()).then(
//           tileListToString()
//         )(l),
//         afterDestroy: mapTileList(tileDestroy<number>()).then(
//           tileListToString()
//         )(l),
//         afterMoveArmy: mapTileList(tileMoveArmy<number>()).then(
//           tileListToString()
//         )(l),
//       };
//     })
//   )([
//     Town(0),
//     Terrain(1),
//     Army(2),
//     Terrain(3),
//     Town(4),
//     Army(5),
//     Terrain(6),
//     Terrain(7),
//     Terrain(8),
//     Town(9),
//     Army(10),
//   ])
// );

// --- Lecture 2 Exercise 4 ---

type Pair<a, b> = {
  left: a;
  right: b;
};

const Pair = <a, b>(left: a, right: b): Pair<a, b> => ({ left, right });

const mapPairLeft = <a1, a2, b>(
  f: Fun<a1, a2>
): Fun<Pair<a1, b>, Pair<a2, b>> =>
  Fun((p) => ({
    ...p,
    left: f(p.left),
  }));

const mapPairRight = <a, b1, b2>(
  f: Fun<b1, b2>
): Fun<Pair<a, b1>, Pair<a, b2>> =>
  Fun((p) => ({
    ...p,
    right: f(p.right),
  }));

const mapPair = <a1, a2, b1, b2>(
  f: Fun<a1, a2>,
  g: Fun<b1, b2>
): Fun<Pair<a1, b1>, Pair<a2, b2>> =>
  mapPairLeft<a1, a2, b1>(f).then(mapPairRight<a2, b1, b2>(g));

const mapPairSuperior = <a1, a2, b1, b2>(
  f: Pair<Fun<a1, a2>, Fun<b1, b2>>
): Fun<Pair<a1, b1>, Pair<a2, b2>> =>
  mapPairLeft<a1, a2, b1>(f.left).then(mapPairRight<a2, b1, b2>(f.right));

// mainLogger.info(
//   mapPair<number, string, string, number>(
//     Fun((n) => `n is ${n}`),
//     Fun((s) => s.length)
//   )(Pair(1, "Hello"))
// );

// mainLogger.info(
//   mapPairSuperior<number, string, string, number>(
//     Pair(
//       Fun((n) => `n is ${n}`),
//       Fun((s) => s.length)
//     )
//   )(Pair(1, "Hello"))
// );
