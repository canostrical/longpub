export const toUnixTimestamp = (date: number): number => {
  return Math.floor(date / 1000);
};

export const fromUnixTimestamp = (timestamp: string): Date => {
  return new Date(Number(timestamp) * 1000);
};

export const toDatetimeLocalStep1 = (timestamp: string): string => {
  const date = fromUnixTimestamp(timestamp);
  return new Date(date.getTime() + new Date().getTimezoneOffset() * -60 * 1000)
    .toISOString()
    .slice(0, 19);
};

export const fromDatetimeLocal = (local: string): number => {
  return toUnixTimestamp(Date.parse(local));
};

export const timeHelpersTest = () => {
  const input: HTMLInputElement = document.createElement("input");
  input.type = "datetime-local";
  input.step = "1";
  const t = Date.now();
  const ts = toUnixTimestamp(t).toString();
  input.value = toDatetimeLocalStep1(ts);
  const ts2 = fromDatetimeLocal(input.value);
  if (Number(ts) !== ts2) {
    console.warn(`timestamp inconsistency: ${ts} ${ts2}`);
  }
};
