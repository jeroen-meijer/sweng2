import { Map } from "immutable";
import { Fun, StatefulFun, id, Pair, getState, unitStatefulFun } from "./";
import { Unit } from "./utilityTypes";

type Memory = Map<string, number>;

const getVariable = (variable: string): StatefulFun<Memory, number> =>
  getState<Memory>().thenBind(
    Fun((memory: Memory) =>
      unitStatefulFun<Memory, number>()(memory.get(variable)!)
    )
  );
