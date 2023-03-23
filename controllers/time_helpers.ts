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
