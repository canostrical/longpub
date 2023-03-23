import {
  toUnixTimestamp,
  toDatetimeLocalStep1,
  fromDatetimeLocal,
} from "./time_helpers";

test("time conversions", () => {
  const input: HTMLInputElement = document.createElement("input");
  input.type = "datetime-local";
  input.step = "1";
  const t = Date.now();
  const ts = toUnixTimestamp(t).toString();
  input.value = toDatetimeLocalStep1(ts);
  const ts2 = fromDatetimeLocal(input.value);
  expect(Number(ts)).toEqual(ts2);
});
