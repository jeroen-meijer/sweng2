import { Map } from "immutable";
import {
  Either,
  Fun,
  Pair,
  StateData,
  apply,
  bindEither,
  getState,
  id,
  ifThen,
  inl,
  inr,
  joinEither,
  mapEither,
  mapStateData,
  setState,
  unitEither,
  unitStateData,
} from "./main";
import { Unit } from "./utilityTypes";

type Result<e, a> = Either<e, a>;
const Error = <e, a>(error: e): Result<e, a> => inl<e, a>()(error);
const Ok = <e, a>(value: a): Result<e, a> => inr<e, a>()(value);

export type Process<s, e, a> = Fun<s, Either<e, StateData<s, a>>>;
const Process = <s, e, a>(f: (_: s) => Either<e, StateData<s, a>>) => Fun(f);

const unitProcess = <s, e, a>(): Fun<a, Process<s, e, a>> =>
  Fun((x: a) =>
    Process((s: s) =>
      unitStateData<s, a>()(s).then(unitEither<e, StateData<s, a>>())(x)
    )
  );

const stateDataToPair = <s, a>(): Fun<StateData<s, a>, Pair<a, s>> =>
  Fun((sd) => Pair(sd.value, sd.state));

const joinProcess = <s, e, a>(): Fun<
  Process<s, e, Process<s, e, a>>,
  Process<s, e, a>
> =>
  Fun((p) =>
    p
      .then(
        mapEither(
          id<e>(),
          stateDataToPair<s, Process<s, e, a>>().then(
            apply<s, Either<e, StateData<s, a>>>()
          )
        )
      )
      .then(joinEither())
  );

const mapProcess = <s, e, a, b>(
  f: Fun<a, b>
): Fun<Process<s, e, a>, Process<s, e, b>> =>
  Fun((p) => p.then(mapEither(id(), mapStateData(id(), f))));

type MemoryValue = number;
type Memory = Map<string, MemoryValue>;
type Error = string;
type Instruction<a> = Process<Memory, Error, a>;

const mapStateDataToProcess = <a>(): Fun<
  StateData<Memory, a>,
  Either<Error, StateData<Memory, a>>
> => Fun((sd) => unitProcess<Memory, Error, a>()(sd.value)(sd.state));

const getProcessState = (): Instruction<Memory> =>
  getState<Memory>().then(mapStateDataToProcess());

const setProcessState = (): Instruction<Unit> =>
  Fun((s) => setState<Memory>(s).then(mapStateDataToProcess())(s));

const hasVariable = (variable: string): Instruction<boolean> =>
  getProcessState().then(
    mapEither(
      id(),
      Fun((sd) =>
        unitStateData<Memory, boolean>()(sd.state)(sd.value.has(variable))
      )
    )
  );

const getVariable = (variable: string): Instruction<MemoryValue> =>
  // Fun<Memory, Either<Error, StateData<Memory, MemoryValue>>> =>
  getState<Memory>().then(
    // ifThen(
    //   Fun((sd) => sd.value.has(variable)),
    //   Fun((sd) =>
    //     inr<Error, StateData<Memory, MemoryValue>>()(
    //       unitStateData<Memory, MemoryValue>()(sd.value)(sd.value.get(variable))
    //     )
    //   ),
    //   Fun((sd) =>
    //     inl<Error, StateData<Memory, MemoryValue>>()(
    //       `variable "${variable}" does not exist`
    //     )
    //   )
    // )
    Fun((sd) =>
      sd.value.has(variable)
        ? unitProcess<Memory, Error, MemoryValue>()(sd.value.get(variable))(
            sd.state
          )
        : inl<Error, StateData<Memory, MemoryValue>>()(
            `variable "${variable}" does not exist`
          )
    )
  );

const getValue = <s, a>(): Fun<StateData<s, a>, a> => Fun((sd) => sd.value);

const setVariable = (variable: string, value: MemoryValue): Instruction<Unit> =>
  getState<Memory>()
    .then(getValue<Memory, Memory>())
    .then(Fun((m: Memory) => setState<Memory>(m.set(variable, value))(m)))
    .then(inr<Error, StateData<Memory, Unit>>());
//   getState<Memory>().then(
//     Fun((sd) =>
//       setState<Memory>(sd.value.set(variable, value)).then(
//         inr<Error, StateData<Memory, Unit>>()
//       )(sd.value)
//     )
//   );

const tryCatch = <a>(t: Instruction<a>, c: Instruction<a>): Instruction<a> =>
  Fun((m: Memory) => {
    // Q: The materials (Lecture 7, part 1) say that the following code should work,
    //    but that doesn't make sense. The `mapEither` call shouldn't change any of the types,
    //    (which is correct for the right hand side, which will be the same value, namely `id()`),
    //    yet the returned left-hand side will be another `Either<Error, StateData<Memory, a>>`.
    //    Therefore, we can't simply do `t.then(mapEither(c(m), id()))` since that will return an
    //    `Either< Either<Error, StateData<Memory, a>>, StateData<Memory, a> >`

    // return t.then(
    //   mapEither<Error, StateData<Memory, a>, Error, StateData<Memory, a>>(
    //     c(m),
    //     id()
    //   )
    // )(m);

    // Q: This is an approach that would work, but is more rudimentary:

    // const res = t(m);
    // if (res.kind === "right") {
    //   return res;
    // } else {
    //   return c(m);
    // }

    // Q: This approach would work as well. It uses a `join` that joins the LHS instead of the right.
    //    Also, the function call `c(m)` needs to be wrapped in a `Fun` since `c(m)` returns an `Either`
    //    directly, but `mapEither` expects a `Fun` that returns an `Either`.

    const joinEitherLeftHandSide = <a, b>(): Fun<
      Either<Either<a, b>, b>,
      Either<a, b>
    > => Fun((e) => (e.kind === "left" ? e.value : e));

    return t
      .then(
        mapEither(
          Fun((_: Error) => c(m)),
          id<StateData<Memory, a>>()
        )
      )
      .then(joinEitherLeftHandSide<Error, StateData<Memory, a>>())(m);
  });

// const swapVariables = (vA: string, vB: string): Instruction<Unit> =>
//   tryCatch(getVariable(vA), setVariable(vA, 0)).then(
//     bindEither(Fun((sd) => getVariable(vA)(sd.state)))
//   );

export const testProcess = () => {};
