import { mainLogger } from "./logger";
import {
  Err,
  Ok,
  Result,
  Some,
  Option,
  Unit,
  unwrapResult,
  mapOption,
  None,
} from "./utilityTypes";

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
export const isPositive = Fun((x: number) => x >= 0);

export const sqrt: Fun<number, Result<number, string>> = ifThen(
  isPositive,
  Fun((x) => Ok(Math.sqrt(x))),
  Fun(() => Err("Cannot take square root of negative number"))
);
export const abs = Fun((x: number) => Math.abs(x));
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
  Fun((x: a[]) =>
    x.length === 0 ? Empty() : Cons(x[0], arrayToList<a>()(x.slice(1)))
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

const primitiveToString: <a>() => Fun<a, string> = <a>() =>
  Fun((x: a) => `${x}`);

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

// --- Lecture 3 Notes ---

// --- Lecture 3 Exercise 1 ---

const zeroStr = Fun((_: Unit) => "");
const plusStr = Fun((s: Pair<string, string>) => s.left + s.right);

// --- Lecture 3 Exercise 2 ---

const zeroList = <a>() => Fun((_: Unit) => Empty<a>());
const plusList = <a>(): Fun<Pair<List<a>, List<a>>, List<a>> =>
  Fun((l: Pair<List<a>, List<a>>) => {
    if (l.left.kind === "empty") {
      return { ...l.right };
    } else if (l.right.kind === "empty") {
      return { ...l.left };
    } else {
      return Cons(l.left.head, plusList<a>()(Pair(l.left.tail, l.right)));
    }
  });

// mainLogger.info(
//   plusList().then(listToString(primitiveToString()))(
//     Pair(arrayToList()(["a", "b", "c"]), arrayToList<string>()(["x", "y", "z"]))
//   )
// );

// --- Lecture 3 Exercise 3 ---

type Identity<a> = a;

const idMonoid = <a>(): Fun<a, Identity<a>> => Fun((x: a) => x);
const joinMonoid = <a>(): Fun<Identity<Identity<a>>, Identity<a>> =>
  // Fun((x) => x)
  //   OR
  idMonoid<a>();

// --- Lecture 3 Exercise 4 ---

const unitOption = <a>(): Fun<a, Option<a>> => Fun((x) => Some(x));
const joinOption = <a>(): Fun<Option<Option<a>>, Option<a>> =>
  Fun((x) =>
    x.kind === "none" || x.value.kind === "none"
      ? None<a>()
      : Some<a>(x.value.value)
  );

// const optionToString = <a>(): Fun<Option<a>, string> =>
//   Fun((x) => (x.kind === "none" ? "None" : `Some(${x.value})`));

// mainLogger.info(joinOption<number>().then(optionToString())(Some(Some(1))));

// --- Lecture 3 Exercise 5 ---

const unitList = <a>(): Fun<a, List<a>> => Fun((x) => Cons(x, Empty()));
const joinList = <a>(): Fun<List<List<a>>, List<a>> =>
  Fun((l) =>
    l.kind === "empty"
      ? Empty<a>()
      : plusList<a>()(Pair(l.head, joinList<a>()(l.tail)))
  );

// mainLogger.info(
//   joinList<number>().then(listToString(primitiveToString()))(
//     arrayToList<List<number>>()([
//       arrayToList<number>()([1, 2, 3]),
//       arrayToList<number>()([4, 5, 6]),
//       arrayToList<number>()([7, 8, 9]),
//     ])
//   )
// );

// --- Lecture 4 Notes ---

const bindOption = <a, b>(f: Fun<a, Option<b>>): Fun<Option<a>, Option<b>> =>
  mapOption(f).then(joinOption());
// Q: Why is the above any different from `mapOption`? Is the fact that `f` goes from an `a` to `Option<b>` significant?
// Copilot Answer: Yes, because `f` is a function that returns an `Option<b>`, we need to use `joinOption` to flatten the nested `Option<Option<b>>` to `Option<b>`.
//    `bind` is useful when we have a function that returns a monadic value, and we want to apply it to a monadic value.
// Q: Is this any different from `.then`?
// Copilot Answer: Yes, because `.then` is used to compose two functions, whereas `bind` is used to apply a function that returns a monadic value to a monadic value.
// Q: What are the practical differences between `bind` and `.then`? Give an example of a situation where you would use one over the other.
// Copilot Answer: `bind` is useful when we have a function that returns a monadic value, and we want to apply it to a monadic value.
//    For example, if we have a function `f: a -> Option<b>`, and we want to apply it to a value `x: Option<a>`, we can use `bind`:
//      `x.bind(f)`.
//    If we have a function `g: b -> c`, and we want to apply it to a value `y: Option<b>`, we can use `.then`:
//      `y.then(g)`.

// Q: The materials mention that `.then` essentially uses `bind` under the hood, making them equivalent.
//    It further states that, as such, the following:
//    ```
//      bind(p, x =>
//      bind(q, y =>
//      bind(r, z =>
//      ...unit(...)...)))
//    ```
//    can be written as:
//    ```
//      p.then(x =>
//      q.then(y =>
//      r.then(z =>
//      ...unit(...)...)))
//    ```
//    This is confusing to me, as `.bind` takes a `f: Fun<a, Option<b>>` and `.then` takes a `f: Fun<a, b>`,
//    leading me to believe they are not the same function and are as such used for different purposes.
//    It also says JavaScript's `Promise` has a `.then` method used exactly like the above, which is also confusing to me.
//    `Promise.then` takes a `f: (a) => b`, not a `f: (a) => Promise<b>`, so how is it equivalent to `bind`?
