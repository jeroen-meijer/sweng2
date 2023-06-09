import { mainLogger } from "./logger";
import { Process } from "./process";
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

export type Fun<input, output> = {
  (_: input): output;
  then: <c>(g: Fun<output, c>) => Fun<input, c>;
} & (input extends output ? SymmetricallyTypedFunFields<input> : Unit) &
  (output extends StateData<input, infer valueType>
    ? StatefulFunFields<input, valueType>
    : Unit);
// &
// (output extends Either<infer e, StateData<input, infer valueType>>
//   ? ProcessFunFields<input, e, valueType>
//   : Unit)

export type SymmetricallyTypedFunFields<a> = {
  repeat: (times: number) => Fun<a, a>;
  repeatUntil: (conditionFn: Fun<a, boolean>) => Fun<a, a>;
};

export type StatefulFunFields<s, a> = {
  thenBind: <b>(f: (_: a) => StatefulFun<s, b>) => StatefulFun<s, b>;
};

// export type ProcessFunFields<s, e, a> = {
//   thenBind: <b>(f: (_: a) => Process<s, e, b>) => Process<s, e, b>;
// };

export const Fun = function <a, b>(f: (_: a) => b): Fun<a, b> {
  const fn = f as Fun<a, b>;
  fn.then = function <c>(this: Fun<a, b>, g: Fun<b, c>): Fun<a, c> {
    return then(this, g);
  };

  (fn as unknown as SymmetricallyTypedFunFields<Unit>).repeat = function (
    this: Fun<Unit, Unit>,
    times: number
  ) {
    return repeat(this, times);
  };

  (fn as unknown as SymmetricallyTypedFunFields<Unit>).repeatUntil = function (
    this: Fun<Unit, Unit>,
    conditionFn: Fun<Unit, boolean>
  ) {
    return repeatUntil(this, conditionFn);
  };

  (fn as unknown as any).thenBind = function <valueTypeA, valueTypeB>(
    this: StatefulFun<a, valueTypeA>,
    f: (_: valueTypeA) => StatefulFun<a, valueTypeB>
  ) {
    return bindStatefulFun(Fun(f))(this);
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

export const then = <a, b, c>(f: Fun<a, b>, g: Fun<b, c>): Fun<a, c> =>
  Fun((x) => g(f(x)));
export const repeat = <a>(f: Fun<a, a>, times: number): Fun<a, a> =>
  times <= 0 ? id() : f.then(repeat(f, times - 1));
export const repeatUntil = <a>(
  f: Fun<a, a>,
  conditionFn: Fun<a, boolean>
): Fun<a, a> =>
  Fun((x) =>
    ifThen<a, a>(conditionFn, id(), f.then(repeatUntil(f, conditionFn)))(x)
  );

export const incr = Fun((x: number) => x + 1);
export const decr = Fun((x: number) => x - 1);
export const isPositive = Fun((x: number) => x >= 0);

export const sqrt: Fun<number, Result<number, string>> = ifThen(
  isPositive,
  Fun((x) => Ok(Math.sqrt(x))),
  Fun(() => Err("Cannot take square root of negative number"))
);
export const abs = Fun((x: number) => Math.abs(x));
export const safeSqrt = abs
  .then<Result<number, string>>(sqrt)
  .then<number>(unwrapResult<number, string>());

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

export type List<a> =
  | {
      kind: "cons";
      head: a;
      tail: List<a>;
    }
  | { kind: "empty" };

export const Cons = <a>(head: a, tail: List<a>): List<a> => ({
  kind: "cons",
  head,
  tail,
});
export const Empty = <a>(): List<a> => ({ kind: "empty" });

export const _arrayToList = <a>(arr: a[]): List<a> =>
  arr.length === 0 ? Empty() : Cons(arr[0], _arrayToList<a>(arr.slice(1)));

export const mapList = <a, b>(f: Fun<a, b>): Fun<List<a>, List<b>> =>
  Fun((l: List<a>) =>
    l.kind == "empty" ? Empty() : Cons(f(l.head), mapList(f)(l.tail))
  );

export const splitChars: Fun<string, List<string>> = Fun((s: string) =>
  s.length === 0 ? Empty() : Cons(s.charAt(0), splitChars(s.slice(1)))
);

export const joinStringSequence: Fun<List<string>, string> = Fun((l) =>
  l.kind === "empty" ? "" : l.head.concat(joinStringSequence(l.tail))
);

export const splitMapJoinStrings = (f: Fun<List<string>, List<string>>) =>
  splitChars.then(f).then(joinStringSequence);

export const encodeByOne: Fun<List<string>, List<string>> = mapList(
  Fun((s) => String.fromCharCode(s.charCodeAt(0) + 1))
);

export const encode: Fun<number, Fun<List<string>, List<string>>> = Fun((n) =>
  mapList<string, string>(Fun((s) => String.fromCharCode(s.charCodeAt(0) + n)))
);

export type Collection<a> = _CollectionEmpty<a> | _CollectionCons<a>;

export type _CollectionEmpty<a> = { kind: "empty" };
export type _CollectionCons<a> = { kind: "cons"; head: a; tail: Collection<a> };

export const collectionToString = <a, c extends Collection<a>>(
  toStr: Fun<c, string>
): Fun<c, string> =>
  Fun((l: c) =>
    l.kind === "empty"
      ? "[EMPTY]"
      : l.tail.kind === "empty"
      ? `${toStr(l)}`
      : `${toStr(l)} => ${collectionToString(toStr)(l.tail as c)}`
  );

export const primitiveToString: <a>() => Fun<_CollectionCons<a>, string> = <
  a
>() => Fun((x) => `${x.head}`);

export const unwrapHead: <a>() => Fun<_CollectionCons<a>, a> = <a>() =>
  Fun((l) => l.head);

// --- Lecture 2 Exercise 2 ---

// (Already implemented as Result<t, e>)

// --- Lecture 2 Exercise 3 ---

export type Tile<a> = {
  value: a;
  kind: "terrain" | "town" | "army";
};

export const Terrain = <a>(value: a): Tile<a> => ({
  value,
  kind: "terrain",
});
export const Town = <a>(value: a): Tile<a> => ({
  value,
  kind: "town",
});
export const Army = <a>(value: a): Tile<a> => ({
  value,
  kind: "army",
});

export const tileToString: <a>() => Fun<Tile<a>, string> = <a>() =>
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

export const tileConvertToTown = <a>() =>
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

export const tileDestroy = <a>() =>
  Fun<Tile<a>, Tile<a>>((t) => ({ ...t, kind: "terrain" }));

export const tileMoveArmy = <a>() =>
  Fun<Tile<a>, Tile<a>>((t) =>
    t.kind !== "terrain" ? { ...t } : { ...t, kind: "army" }
  );

export const mapTileList: <a>(
  f: Fun<Tile<a>, Tile<a>>
) => Fun<List<Tile<a>>, List<Tile<a>>> = <a>(f: Fun<Tile<a>, Tile<a>>) =>
  mapList(f);

export const tileListToString = <a>() =>
  collectionToString(unwrapHead<Tile<a>>().then(tileToString<a>()));

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

export type Pair<a, b> = {
  left: a;
  right: b;
};

export const Pair = <a, b>(left: a, right: b): Pair<a, b> => ({ left, right });

export const mapPairLeft = <a1, a2, b>(
  f: Fun<a1, a2>
): Fun<Pair<a1, b>, Pair<a2, b>> =>
  Fun((p) => ({
    ...p,
    left: f(p.left),
  }));

export const mapPairRight = <a, b1, b2>(
  f: Fun<b1, b2>
): Fun<Pair<a, b1>, Pair<a, b2>> =>
  Fun((p) => ({
    ...p,
    right: f(p.right),
  }));

export const mapPair = <a1, a2, b1, b2>(
  f: Fun<a1, a2>,
  g: Fun<b1, b2>
): Fun<Pair<a1, b1>, Pair<a2, b2>> =>
  mapPairLeft<a1, a2, b1>(f).then(mapPairRight<a2, b1, b2>(g));

export const mapPairSuperior = <a1, a2, b1, b2>(
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

export const zeroStr = Fun((_: Unit) => "");
export const plusStr = Fun((s: Pair<string, string>) => s.left + s.right);

// --- Lecture 3 Exercise 2 ---

export const zeroList = <a>() => Fun((_: Unit) => Empty<a>());
export const plusList = <a>(): Fun<Pair<List<a>, List<a>>, List<a>> =>
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

export type Identity<a> = a;

export const idMonoid = <a>(): Fun<a, Identity<a>> => Fun((x: a) => x);
export const joinMonoid = <a>(): Fun<Identity<Identity<a>>, Identity<a>> =>
  // Fun((x) => x)
  //   OR
  idMonoid<a>();

// --- Lecture 3 Exercise 4 ---

export const unitOption = <a>(): Fun<a, Option<a>> => Fun((x) => Some(x));
export const joinOption = <a>(): Fun<Option<Option<a>>, Option<a>> =>
  Fun((x) =>
    x.kind === "none" || x.value.kind === "none"
      ? None<a>()
      : Some<a>(x.value.value)
  );

// const optionToString = <a>(): Fun<Option<a>, string> =>
//   Fun((x) => (x.kind === "none" ? "None" : `Some(${x.value})`));

// mainLogger.info(joinOption<number>().then(optionToString())(Some(Some(1))));

// --- Lecture 3 Exercise 5 ---

export const unitList = <a>(): Fun<a, List<a>> => Fun((x) => Cons(x, Empty()));
export const joinList = <a>(): Fun<List<List<a>>, List<a>> =>
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

export const bindOption = <a, b>(
  f: Fun<a, Option<b>>
): Fun<Option<a>, Option<b>> => mapOption(f).then(joinOption());
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

// --- Lecture 4 Exercise 1 ---

export const bindList = <a, b>(k: Fun<a, List<b>>): Fun<List<a>, List<b>> =>
  mapList(k).then(joinList());

// const bindListTester = <a, b>(
//   input: a[],
//   f: (x: a) => b[]
// ): { res: List<b>; str: string } => {
//   const fn = bindList<a, b>(Fun((x: a) => f(x)).then(arrayToList<b>()));
//   const res = fn(arrayToList<a>()(input));
//   return {
//     res,
//     str: listToString(primitiveToString())(res),
//   };
// };

// mainLogger.info(bindListTester(["abc", "def", "ghi"], (x) => x.split("")).str);

// --- Lecture 4 Exercise 2 ---

export type Set<a> =
  | {
      kind: "empty";
    }
  | {
      kind: "cons";
      head: a;
      tail: Set<a>;
    };

export const Set = {
  empty: <a>(): Set<a> => ({ kind: "empty" }),
  cons: <a>(head: a, tail: Set<a>): Set<a> => ({
    kind: "cons",
    head,
    tail: setPurgeDuplicates(tail, [head]),
  }),
};

export const setPurgeDuplicates = <a>(
  s: Set<a>,
  visitedElements: a[]
): Set<a> => {
  if (s.kind === "empty") {
    return Set.empty();
  } else {
    const headIsDuplicate = visitedElements.includes(s.head);
    const tailWithoutDuplicates = setPurgeDuplicates(s.tail, [
      ...visitedElements,
      s.head,
    ]);

    if (headIsDuplicate) {
      return tailWithoutDuplicates;
    } else {
      return { ...s, tail: tailWithoutDuplicates };
    }
  }
};

export const _arrayToSet = <a>(arr: a[]): Set<a> =>
  arr.length === 0 ? Set.empty() : Set.cons(arr[0], _arrayToSet(arr.slice(1)));

export const mapSet = <a, b>(f: Fun<a, b>): Fun<Set<a>, Set<b>> =>
  Fun((s) =>
    s.kind === "empty" ? Set.empty() : Set.cons(f(s.head), mapSet(f)(s.tail))
  );

export const plusSet = <a>(): Fun<Pair<Set<a>, Set<a>>, Set<a>> =>
  Fun((p) => {
    if (p.left.kind === "empty") {
      return p.right;
    } else if (p.right.kind === "empty") {
      return p.left;
    } else {
      return Set.cons(p.left.head, plusSet<a>()(Pair(p.left.tail, p.right)));
    }
  });

export const unitSet = <a>(): Fun<a, Set<a>> =>
  Fun((x) => Set.cons(x, Set.empty()));
export const joinSet = <a>(): Fun<Set<Set<a>>, Set<a>> =>
  Fun((ns) => {
    if (ns.kind === "empty") {
      return Set.empty();
    }

    return plusSet<a>()(Pair(ns.head, joinSet<a>()(ns.tail)));
  });

export const bindSet = <a, b>(k: Fun<a, Set<b>>): Fun<Set<a>, Set<b>> =>
  mapSet(k).then(joinSet());

// mainLogger.info(
//   joinSet<number>().then(collectionToString(primitiveToString()))(
//     _arrayToSet([_arrayToSet([1, 2, 3, 4, 5]), _arrayToSet([3, 4, 5, 6, 7])])
//   )
// );

// --- Lecture 4 Exercise 3 ---

export type Dll<a> = _DllEmpty<a> | _DllCons<a>;

export type _DllEmpty<a> = {
  kind: "empty";
};

export type _DllCons<a> = {
  kind: "cons";
  head: a;
  prev: Dll<a>;
  tail: Dll<a>;
};

export const Dll = {
  empty: <a>(): _DllEmpty<a> => ({ kind: "empty" }),
  cons: <a>(head: a, prev: Dll<a>, tail: Dll<a>): _DllCons<a> => ({
    kind: "cons",
    head,
    prev,
    tail,
  }),
};

export const _arrayToDll = <a>(arr: a[]): Dll<a> => {
  if (arr.length === 0) {
    return Dll.empty();
  }

  const [e, ...rest] = arr;
  const thisDll = Dll.cons(e, Dll.empty(), _arrayToDll(rest));
  if (thisDll.tail.kind === "cons") {
    thisDll.tail.prev = thisDll;
  }

  return thisDll;
};

// mainLogger.info(_arrayToDll([1, 2, 3]));

export const plusDll = <a>(): Fun<Pair<Dll<a>, Dll<a>>, Dll<a>> =>
  Fun((p) => {
    if (p.left.kind === "empty") {
      return p.right;
    } else if (p.right.kind === "empty") {
      return p.left;
    } else {
      const thisDll = Dll.cons<a>(
        p.left.head,
        Dll.empty(),
        plusDll<a>()(Pair(p.left.tail, p.right))
      );
      if (thisDll.tail.kind === "cons") {
        thisDll.tail.prev = thisDll;
      }

      return thisDll;
    }
  });

export const dllSeekStart = <a>() =>
  Fun((dll: Dll<a>): Dll<a> => {
    if (dll.kind === "empty") {
      return Dll.empty();
    }

    var current: _DllCons<a> = dll;
    while (current.prev.kind === "cons") {
      current = current.prev;
    }

    return current;
  });

export const unitDll = <a>(): Fun<a, Dll<a>> =>
  Fun((x) => Dll.cons(x, Dll.empty(), Dll.empty()) as Dll<a>);
export const joinDll = <a>(): Fun<Dll<Dll<a>>, Dll<a>> =>
  Fun((nd) => {
    if (nd.kind === "empty") {
      return Dll.empty() as Dll<a>;
    }

    const start = dllSeekStart<Dll<a>>()(nd);
    const innerJoin = (nd: Dll<Dll<a>>): Dll<a> => {
      if (nd.kind === "empty") {
        return Dll.empty() as Dll<a>;
      }

      const thisDll = plusDll<a>()(Pair(nd.head, innerJoin(nd.tail)));
      if (thisDll.kind === "cons" && thisDll.tail.kind === "cons") {
        thisDll.tail.prev = thisDll;
      }

      return thisDll;
    };

    return innerJoin(start);
  });

export const verifyDll = <a>(
  d: Dll<a>
): { isValid: true } | { isValid: false; msg: string; instance: Dll<a> } => {
  if (d.kind === "empty") {
    return { isValid: true };
  }

  if (d.tail.kind === "empty") {
    return { isValid: true };
  }

  let lastDll = d;
  let currentDll: Dll<a> = d.tail;
  while (currentDll.kind === "cons") {
    if (currentDll.prev != lastDll) {
      return {
        isValid: false,
        msg:
          `the Dll with value ${currentDll.head} does not have its 'prev' field set to the Dll before it. ` +
          `Expected value: ${lastDll.head}. Actual value: ${currentDll.prev}`,
        instance: currentDll,
      };
    } else if (lastDll.tail != currentDll) {
      return {
        isValid: false,
        msg:
          `the Dll with value ${lastDll.head} does not have its 'tail' field set to the Dll after it. ` +
          `Expected value: ${currentDll.head}. Actual value: ${lastDll.tail}`,
        instance: lastDll,
      };
    }

    lastDll = currentDll;
    currentDll = currentDll.tail;
  }

  return { isValid: true };
};

export const dllNodeToStringWithDirectNeighbors: Fun<Dll<any>, string> = Fun(
  (dll: Dll<any>): string => {
    if (dll.kind === "empty") {
      return "EMPTY";
    }

    const toStringNested = (maybeDll: any) => {
      if (maybeDll?.kind === "cons") {
        return dllNodeToStringWithDirectNeighbors(maybeDll);
      } else {
        return `${maybeDll}`;
      }
    };

    return `(${
      dll.prev.kind === "empty" ? "EMPTY" : toStringNested(dll.prev.head)
    } < ${toStringNested(dll.head)} > ${
      dll.tail.kind === "empty" ? "EMPTY" : toStringNested(dll.tail.head)
    })`;
  }
);

export const mapDll = <a, b>(f: Fun<a, b>): Fun<Dll<a>, Dll<b>> =>
  Fun((x) => {
    if (x.kind === "empty") {
      return Dll.empty();
    }

    const start = dllSeekStart<a>()(x);
    const innerMap = (x: Dll<a>): Dll<b> => {
      if (x.kind === "empty") {
        return Dll.empty();
      }

      const thisDll = Dll.cons(f(x.head), Dll.empty(), innerMap(x.tail));
      if (thisDll.tail.kind === "cons") {
        thisDll.tail.prev = thisDll;
      }
      return thisDll;
    };

    return innerMap(start);
  });

export const bindDll = <a, b>(k: Fun<a, Dll<b>>): Fun<Dll<a>, Dll<b>> =>
  mapDll(k).then(joinDll());

export const _dllToString = (dll: Dll<any>, simple: boolean = false) => {
  return collectionToString<any, Dll<any>>(
    simple
      ? Fun((x) => `${x.kind === "empty" ? "EMPTY" : x.head}`)
      : dllNodeToStringWithDirectNeighbors
  )(dll);
};

// (() => {
//   const dll1 = _arrayToDll([1, 2, 3, 4, 5]);
//   const dll2 = _arrayToDll([3, 4, 5, 6, 7]);
//   const dll1Plus2 = plusDll()(Pair(dll1, dll2));

//   const ndll = _arrayToDll([
//     _arrayToDll([1, 2, 3]),
//     _arrayToDll([4, 5, 6]),
//     _arrayToDll([7, 8, 9]),
//   ]);

//   let ndllFromMidpoint = { ...ndll };
//   ndllFromMidpoint = (ndllFromMidpoint as _DllCons<Dll<number>>).tail;

//   mainLogger.info({
//     "verify dll1": {
//       ...verifyDll(dll1),
//       dll: _dllToString(dll1, true),
//     },
//     "verify dll2": {
//       ...verifyDll(dll2),
//       dll: _dllToString(dll2, true),
//     },
//     "verify map dll1": {
//       ...verifyDll(mapDll<number, number>(Fun((x) => x * 2))(dll1)),
//       dll: _dllToString(mapDll<number, number>(Fun((x) => x * 2))(dll1), true),
//     },
//     "verify plus dll1+dll2": {
//       ...verifyDll(dll1Plus2),
//       dll: _dllToString(dll1Plus2, true),
//     },
//     "verify nestedDll": {
//       ...verifyDll(ndll),
//       dll: _dllToString(ndll, true),
//       first: _dllToString((ndll as any).head),
//       second: _dllToString((ndll as any).tail.head),
//       third: _dllToString((ndll as any).tail.tail.head),
//     },
//     "verify joinDll": {
//       ...verifyDll(joinDll()(ndll)),
//       dll: _dllToString(joinDll()(ndll), true),
//     },
//     "verify midpoint dll": {
//       ...verifyDll(ndllFromMidpoint),
//       dll: _dllToString(ndllFromMidpoint),
//     },
//     "verify midpoint dll after seek": {
//       ...verifyDll(dllSeekStart()(ndllFromMidpoint)),
//       dll: _dllToString(dllSeekStart()(ndllFromMidpoint)),
//     },
//     "verify joinDll from midpoint": {
//       ...verifyDll(joinDll()(ndllFromMidpoint)),
//       dll: _dllToString(joinDll()(ndllFromMidpoint), true),
//     },
//   });
// })();

// --- Lecture 5 Notes ---

export const none = <a>(): Fun<Unit, Option<a>> => Fun((_) => None());
export const some = <a>(): Fun<a, Option<a>> => Fun((x) => Some(x));

export const mapOptionNew = <a, b>(f: Fun<a, b>): Fun<Option<a>, Option<b>> =>
  Fun((x: Option<a>) =>
    x.kind === "none" ? none<b>()({}) : f.then(some<b>())(x.value)
  );

let map_Option_FROM_MATERIAL = <a, b>(
  f: Fun<a, b>
): Fun<Option<a>, Fun<Unit, Option<b>> | Fun<a, Option<b>>> =>
  Fun((x) => (x.kind == "none" ? none<b>() : f.then(some<b>())));

// Q: I believe map_Option as stated in the materials is incorrect.
//    ```
//    let map_Option = <a,b>(f:Fun<a,b>) : Fun<Option<a>,Option<b>> =>
//      Fun(x => x.kind == "none" ? none<b>() : f.then(some<b>()))
//    ```
//    I believe this function does not return a `Fun<Option<a>, Option<b>>`,
//    but rather a `Fun<Option<a>, (Fun<Unit, Option<b>> | Fun<a, Option<b>>)>`.
//    It's missing the function call on both `none` and `f.then(some())`, so it should be
//    ```
//    const mapOptionNew = <a, b>(f: Fun<a, b>): Fun<Option<a>, Option<b>> =>
//      Fun((x: Option<a>) =>
//        x.kind === "none"
//          ? none<b>()({})               // <-- Added the `({})` part
//          : f.then(some<b>())(x.value)  // <-- Added the `(x.value)` part
//      );
//    ```
//
//    Can you verify this?

// --- Lecture 5 Exercise 1 ---

interface ServerConnection {
  /**
   * The IP address of the server.
   */
  ip: string;
  /**
   * The message the server will respond with.
   */
  hello: string;
}

/**
 * A list of fake servers.
 */
export const servers: ServerConnection[] = [
  { ip: "25.132.58.167", hello: "hello" },
  { ip: "81.106.142.123", hello: "what's poppin'?" },
  { ip: "214.98.39.99", hello: "hey" },
  { ip: "237.178.79.180", hello: "wussup?" },
  { ip: "5.7.136.67", hello: "guten Tag" },
  { ip: "168.195.1.137", hello: "good night" },
  { ip: "118.35.78.225", hello: "aloha" },
  { ip: "229.241.224.152", hello: "salutations" },
  { ip: "255.74.178.209", hello: "what's the rumpus?" },
  { ip: "137.81.12.199", hello: "hola" },
];

interface ServerContent {
  ip: string;
  content: string;
}

export type ConnectionResult =
  | {
      status: "success";
    }
  | {
      status: "failure";
      reason: string;
    };

export const _checkCanConnect = (ip: string): ConnectionResult =>
  servers.find((s) => s.ip === ip) === undefined
    ? {
        status: "failure",
        reason: "invalid ip",
      }
    : !ip.endsWith("9")
    ? { status: "failure", reason: "connection failure" }
    : { status: "success" };

export const _checkCanRequest = (ip: string): boolean =>
  !ip.endsWith("9") && !ip.endsWith("7");

export const connect = Fun((ip: string): Option<ServerConnection> => {
  const serverIndex = servers.findIndex((s) => s.ip === ip);
  if (serverIndex === -1 || _checkCanConnect(ip).status == "failure") {
    return none<ServerConnection>()({});
  }

  return some<ServerConnection>()(servers[serverIndex]);
});

export const get = Fun((s: ServerConnection) =>
  !_checkCanRequest(s.ip)
    ? none<ServerContent>()({})
    : some<ServerContent>()({
        ip: s.ip,
        content: s.hello,
      })
);

export const fetch = connect.then(bindOption(get));

// Q: `bind` can be thought of as "`map` as long as everything went the way you thought it would"?
//    For example, binding an Option means "`map` if it's a Some". `bindLeft` is "`map` is this Either is a left".

// --- Lecture 4 Exercise 2 ---

export type Either<a, b> =
  | {
      kind: "left";
      value: a;
    }
  | { kind: "right"; value: b };

export const inl = <a, b>() =>
  Fun((value: a): Either<a, b> => ({ kind: "left", value }));
export const inr = <a, b>() =>
  Fun((value: b): Either<a, b> => ({ kind: "right", value }));

export const mapEither = <a1, b1, a2, b2>(
  f: Fun<a1, a2>,
  g: Fun<b1, b2>
): Fun<Either<a1, b1>, Either<a2, b2>> =>
  Fun((e) =>
    e.kind === "left"
      ? // Run `e.value: a1` through `f` -> `a2`, then package it up
        // into a left-sided `Either<a2, b2>`
        f.then(inl<a2, b2>())(e.value)
      : // Run `e.value: b1` through `g` -> `b2`, then package it up
        // into a right-sided `Either<a2, b2>`
        g.then(inr<a2, b2>())(e.value)
  );

export const unitEither = <a, b>(): Fun<b, Either<a, b>> => inr<a, b>();
export const joinEither = <a, b>(): Fun<
  Either<a, Either<a, b>>,
  Either<a, b>
> => Fun((e) => (e.kind === "left" ? inl<a, b>()(e.value) : e.value));

export const bindEither = <a, b1, b2>(
  f: Fun<b1, Either<a, b2>>
): Fun<Either<a, b1>, Either<a, b2>> =>
  mapEither(id<a>(), f).then(joinEither());

export type Exception<a> = Either<string, a>;

export const mapException = <a, b>(
  f: Fun<a, b>
): Fun<Exception<a>, Exception<b>> => mapEither(id(), f);

export const unitException = <a>(): Fun<a, Exception<a>> => inr();
export const createException = <a>(): Fun<string, Exception<a>> => inl();

export const joinException = <a>(): Fun<
  Exception<Exception<a>>,
  Exception<a>
> => joinEither<string, a>();

export const bindException = <a, b>(f: Fun<a, Exception<b>>) => bindEither(f);

export const _checkCanConnectNew = Fun((ip: string): Exception<string> => {
  const server = servers.find((s) => s.ip === ip);
  if (server === undefined) {
    return createException<string>()("invalid ip");
  } else if (ip.endsWith("9")) {
    return createException<string>()("connection failed");
  } else {
    return unitException<string>()(ip);
  }
});

export const _checkCanRequestNew = Fun((ip: string): Exception<string> => {
  if (ip.startsWith("2")) {
    return createException<string>()("network error");
  } else {
    return unitException<string>()(ip);
  }
});

// TODO: Finish

// --- Lecture 5 Notes ---

/**
 * The data used by state monads (instead of `Pair<s, a>`)
 */
export type StateData<s, a> = {
  state: s;
  value: a;
};

export const StateData = <s, a>(state: s, value: a): StateData<s, a> => ({
  state,
  value,
});

export const unitStateData = <s, a>(): Fun<s, Fun<a, StateData<s, a>>> =>
  Fun((state: s) => Fun((value: a) => ({ value, state } as StateData<s, a>)));

/*
// An example function that, when called with a value of type `a`, returns
// a state data containing that value and the state of type `StudentDb`.
export type StudentDb = {
  [id: string]: {
    name: string;
    age: number;
  };
}

export const _unitStudentDb = <a>() => unitStateData<StudentDb, a>()({});

// Example usage:
export const _exampleStudentDb = _unitStudentDb<string>()("hello");
console.log(_exampleStudentDb.state); // {}
console.log(_exampleStudentDb.value); // "hello"
*/

// Functionally equivalent to mapPair.
export const mapStateData = <a, b, s>(
  f: Fun<s, s>,
  g: Fun<a, b>
): Fun<StateData<s, a>, StateData<s, b>> =>
  Fun((sd) => StateData(f(sd.state), g(sd.value)));

// Functionally equivalent to joinPair.
export const joinStateData = <s, a>(): Fun<
  StateData<s, StateData<s, a>>,
  StateData<s, a>
> => Fun((sd) => StateData(sd.state, sd.value.value));

/**
 * Encapsulates a computation that returns a result of an arbitrary type.
 * I.e., a `unit<a>`
 *
 * In:  unit (nothing)
 * Out: A value of type `a`.
 */
export type Producer<a> = Fun<Unit, a>;

/**
 * A function that reads a state `s` and returns a value `a`.
 *
 * In:  A state of type `s`.
 * Out: A value of type `a`.
 */
export type Reader<s, a> = Fun<s, a>;

/**
 * The state monad.
 *
 * A function that takes a state `s` and returns a StateData of a value `a` and a new state `s`.
 * The value `a` is the result of the computation, and the new state `s` is the updated state.
 *
 * In:  A state of type `s`.
 * Out: A tuple of a value of type `a` and a new state of type `s`.
 */
export type StatefulFun<s, a> = Fun<s, StateData<s, a>>;

export const StatefulFun = <s, a>(
  f: (_: s) => StateData<s, a>
): StatefulFun<s, a> => Fun(f);

export const bindStatefulFun = <s, a, b>(f: Fun<a, StatefulFun<s, b>>) =>
  mapStatefulFun<s, a, StatefulFun<s, b>>(f).then(joinStatefulFun<s, b>());

// Since `StatefulFun` is a monad, we need the `map`, `unit`, and `join` operations.

/**
 * Maps a function `f` over a `StatefulFun<s, a>`.
 *
 * `StatefulFun<s, a>` is a function itself that takes a state `s` and returns
 * a tuple of a value `a` and a new state `s`. In other words, `StatefulFun` functions
 * are functions that take a state and return a new state with a value that resulted
 * from the computation.
 *
 * The steps for `mapState` are therefore:
 * 1. Run the state `StatefulFun<s, a>` to get a tuple of a value `a` and a new state `s`.
 * 2. Run the function `f` on the value `a` to get a new value `b`.
 * 3. Return a new state `StatefulFun<s, b>` that returns the new value `b` and the new state `s`.
 *
 * The first step simply becomes `s.then(...)`.
 * After that, we get a `StateData<s, a>`, so we can use `mapStateData` to run `f` on the value `a`.
 * Finally, we return a new state `StatefulFun<s, b>` that returns the new value `b` and the new state `s`.
 *
 * In:  A function `f` that takes a value of type `a` and returns a value of type `b`.
 * Out: A function:
 *      In:  A state of type `StatefulFun<s, a>`.
 *      Out: A state of type `StatefulFun<s, b>`.
 */
export const mapStatefulFun = <s, a, b>(
  f: Fun<a, b>
): Fun<StatefulFun<s, a>, StatefulFun<s, b>> =>
  Fun((s) => s.then(mapStateData(id(), f)));

/**
 * Creates a state `StatefulFun<s, a>` that returns a tuple of a value `a` and a state `s`.
 * The value `a` is the value given, and the state `s` is the updated state.
 *
 * In:  A value of type `a`.
 * Out: A state of type `StatefulFun<s, a>`.
 */
export const unitStatefulFun = <s, a>(): Fun<a, StatefulFun<s, a>> =>
  Fun((a) => StatefulFun((s) => StateData(s, a)));

/**
 * Applies a function `Fun<a, b>` to a value `a` and returns the result `b`.
 *
 * Used in `joinStatefulFun`.
 *
 * In:  A pair of `Fun<a, b>` and a value `a`.
 * Out: A value `b`.
 */
export const apply = <a, b>(): Fun<Pair<Fun<a, b>, a>, b> =>
  Fun((fa) => fa.left(fa.right));

// The same as `apply` but for `StateData`.
export const applyStateData = <s, a>(): Fun<StateData<s, Fun<s, a>>, a> =>
  Fun((sd) => sd.value(sd.state));

/**
 * Joins a state `StatefulFun<s, StatefulFun<s, a>>` into a state `StatefulFun<s, a>`.
 * The first state `StatefulFun<s, StatefulFun<s, a>>` returns a tuple of a value `StatefulFun<s, a>`
 * and a state `s`. Then, we run the `StatefulFun<s, a>` to get a tuple of a value `a` and a state `s`.
 * Finally, we return a new state `StatefulFun<s, a>` that returns the value `a` and the state `s`.
 *
 * In:  A state of type `StatefulFun<s, StatefulFun<s, a>>`.
 * Out: A state of type `StatefulFun<s, a>`.
 */
export const joinStatefulFun = <s, a>(): Fun<
  StatefulFun<s, StatefulFun<s, a>>,
  StatefulFun<s, a>
> => Fun((ns) => ns.then(applyStateData()));

/**
 * A state operation (function that takes the state as input and returns a new state and a value)
 * that returns the state itself as both the value and the state.
 *
 * The function itself works like this:
 * 1. The state `s` is given as input.
 * 2. Since any `StatefulFun` returns data containing the new state and some value,
 *    we simply return the state `s` as the value and the state (i.e., `StateData<s, s>(s, s)`).
 *
 * In:  A state of type `s`.
 * Out: A state of type `StatefulFun<s, s>`.
 */
export const getState = <s>(): StatefulFun<s, s> =>
  StatefulFun((s) => StateData(s, s));

/**
 * A state operation (function that takes the state as input and returns a new state and a value)
 * that returns the state given when the function was created as both the value and the state.
 *
 * In a functional pipeline, this means that the state given when the function was created is
 * passed through the pipeline unchanged, and any functions after it will now use the provided
 * state as input.
 *
 * The function itself works like this:
 * 1. When this function is called, a state `s` is given as input.
 * 2. Then it returns a function that, when called, returns a `StateData<s, Unit>`.
 *    This contains a value of `unit` since there is no value to return, and the state `s` is
 *    the same as the state given when the function was created.
 *
 * In:  A state of type `s`.
 * Out: A function:
 *      In:  Unit (no value).
 *      Out: A `StatefulFun<s, Unit>` function that ignores the incoming state and returns
 *           a new `StateData` with the `state` set to the new state given when the function
 *           was made, along with a `Unit` value (since this operation has no real "result").
 */
export const setState = <s>(newState: s): StatefulFun<s, Unit> =>
  StatefulFun((currentState) => StateData(newState, {}));

// RenderingBuffer example

export type RenderingBuffer = string;
export type Renderer = StatefulFun<RenderingBuffer, Unit>;
export const Renderer = StatefulFun<RenderingBuffer, Unit>;

export const renderNothing = Renderer((buffer) => StateData(buffer, {}));
export const renderString = (s: string) =>
  Renderer((buffer) => StateData(buffer + s, {}));
export const renderAsterisk = renderString("*");
export const renderSpace = renderString(" ");
export const renderNewline = renderString("\n");

export const rN: Fun<
  RenderingBuffer,
  StateData<RenderingBuffer, Unit>
> = renderNothing;

// const renderLine = (n: number): Fun<RenderingBuffer, StateData<RenderingBuffer, Unit>> =>
//   n <= 0 ? renderNothing : renderAsterisk.then(getState().then());
