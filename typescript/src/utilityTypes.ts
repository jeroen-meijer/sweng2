// Types similar to Rust's for use in TypeScript

import { Fun } from "./main";

export type Unit = {};

export type Result<t, e> = { kind: "ok"; value: t } | { kind: "err"; value: e };
export const Ok = <t, e>(value: t): Result<t, e> => ({
  kind: "ok",
  value: value,
});
export const Err = <t, e>(value: e): Result<t, e> => ({
  kind: "err",
  value: value,
});
export const mapOk = <t1, t2, e>(f: Fun<t1, t2>) =>
  Fun((x: Result<t1, e>) => (x.kind == "err" ? Err(x.value) : Ok(f(x.value))));
export const mapError = <t, e1, e2>(f: Fun<e1, e2>) =>
  Fun((x: Result<t, e1>) => (x.kind == "ok" ? Ok(x.value) : Err(f(x.value))));

export const unwrapResult = <a, b>() =>
  Fun((x: Result<a, b>) => {
    if (x.kind === "ok") {
      return x.value;
    } else {
      throw Error("Cannot unwrap a None or Err");
    }
  });

export const expectResult = <a, b>(msg: string) =>
  Fun((x: Result<a, b>) => {
    try {
      return unwrapResult<a, b>()(x);
    } catch (_) {
      throw Error(msg);
    }
  });

export type Option<a> = { kind: "none" } | { kind: "some"; value: a };
export const None = <a>(): Option<a> => ({ kind: "none" });
export const Some = <a>(value: a): Option<a> => ({
  kind: "some",
  value: value,
});
export const mapOption = <a, b>(f: Fun<a, b>): Fun<Option<a>, Option<b>> =>
  Fun((x: Option<a>) => (x.kind == "none" ? None() : Some(f(x.value))));

export const unwrapOption = <a>() =>
  Fun((x: Option<a>) => {
    if (x.kind === "some") {
      return x.value;
    } else {
      throw Error("Cannot unwrap a None or Err");
    }
  });

export const expectOption = <a>(msg: string) =>
  Fun((x: Option<a>) => {
    try {
      return unwrapOption<a>()(x);
    } catch (_) {
      throw Error(msg);
    }
  });
