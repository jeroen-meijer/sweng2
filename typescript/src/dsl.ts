import { Map } from "immutable";
import {
  Fun,
  StatefulFun,
  id,
  Pair,
  getState,
  unitStatefulFun,
  StateData,
  unitStateData,
  setState,
} from "./main";
import { Unit } from "./utilityTypes";
import { mainLogger } from "./logger";

type Memory = Map<string, number>;
const Memory = Map<string, number>;

type InstructionFun<a> = StatefulFun<Memory, a>;
const InstructionFun = <a>(
  f: (_: Memory) => StateData<Memory, a>
): InstructionFun<a> => StatefulFun<Memory, a>(f);

const getVariable = (variable: string): InstructionFun<number> =>
  getState<Memory>().thenBind((memory: Memory) =>
    unitStatefulFun<Memory, number>()(memory.get(variable)!)
  );

// Q: Why choose the above approach over this simpler version, since we already get access to the state
//    in every `StatefulFun` (or `State<>` or `Stateful`)
const getVariableSimple = (variable: string): InstructionFun<number> =>
  InstructionFun((memory: Memory) =>
    unitStateData<Memory, number>()(memory)(memory.get(variable)!)
  );

const setVariable = (variable: string, value: number): InstructionFun<Unit> =>
  getState<Memory>().thenBind((memory) =>
    setState(memory.set(variable, value))
  );

// Q: Same here as the question above, although this is arguably uglier than the main version
//    since the `memory` argument passed call `setState` is redundant but necessary.
const setVariableSimple = (
  variable: string,
  value: number
): InstructionFun<Unit> =>
  InstructionFun((memory) => setState(memory.set(variable, value))(memory));

const incrementVariable = (variable: string) =>
  getVariable(variable).thenBind((value) => setVariable(variable, value + 1));

const noopStateData = (memory: Memory) =>
  unitStateData<Memory, Unit>()(memory)({});

const logState = InstructionFun<Unit>((memory) => {
  mainLogger.info(memory.toObject());
  return noopStateData(memory);
});

const logMessage = (msg: unknown) =>
  InstructionFun<Unit>((memory) => {
    mainLogger.info(msg);

    return noopStateData(memory);
  });

const seq = (
  current: InstructionFun<Unit>,
  next: InstructionFun<Unit>
): InstructionFun<Unit> => current.thenBind((_) => next);

const skip = (): InstructionFun<Unit> => unitStatefulFun<Memory, Unit>()({});

const ifThenElse = (
  conditionFn: InstructionFun<boolean>,
  thenFn: InstructionFun<Unit>,
  elseFn: InstructionFun<Unit>
): InstructionFun<Unit> =>
  conditionFn.thenBind((res) => (res ? thenFn : elseFn));

const whileLoop = (
  conditionFn: InstructionFun<boolean>,
  body: InstructionFun<Unit>
): InstructionFun<Unit> =>
  conditionFn.thenBind((res) =>
    !res
      ? unitStatefulFun<Memory, Unit>()({})
      : body.thenBind((_) => whileLoop(conditionFn, body))
  );

export const dslTest = () => {
  const m = Memory();

  const program = logState
    .thenBind((_) => getState<Memory>())
    .thenBind((memory) => setState(memory.set("a", 0)))
    .thenBind((_) => incrementVariable("a"))
    .thenBind((_) => logState)
    .thenBind((_) =>
      ifThenElse(
        // InstructionFun((m) => {
        //   return unitStateData<Memory, boolean>()(m)(m.get("a") == 0);
        // }),
        getVariable("a").thenBind((a) =>
          unitStatefulFun<Memory, boolean>()(a == 0)
        ),
        logMessage("a is zero :("),
        logMessage("a has a value!")
      )
    )
    .thenBind((_) =>
      whileLoop(
        getVariable("a").thenBind((a) =>
          unitStatefulFun<Memory, boolean>()(a < 10)
        ),
        getVariable("a")
          .thenBind((a) => logMessage(`a is ${a}. not high enough!`))
          .thenBind((_) => incrementVariable("a"))
      )
    )
    .thenBind((_) => logState);

  program(m);
};
