// Mirrors CuanLater.Reason.
export enum Reason {
  NONE,
  NOT_JOINED,
  UNKNOWN_SHOP,
  FROZEN,
  ZERO_AMOUNT,
  OVER_WEEKEND_LIMIT,
  OVER_WEEKDAY_LIMIT,
  OVER_DAILY_LIMIT,
  OVER_TAP_LIMIT,
  POOL_EMPTY,
}

/** One-line reason for the terminal and Recent sales. */
export const reasonLine: Record<Reason, string> = {
  [Reason.NONE]: '',
  [Reason.NOT_JOINED]: 'Card not activated',
  [Reason.UNKNOWN_SHOP]: 'Shop not registered',
  [Reason.FROZEN]: 'Card frozen by its owner',
  [Reason.ZERO_AMOUNT]: 'Amount is zero',
  [Reason.OVER_WEEKEND_LIMIT]: 'Over the weekend limit',
  [Reason.OVER_WEEKDAY_LIMIT]: 'Over the weekday limit',
  [Reason.OVER_DAILY_LIMIT]: 'Over the daily limit',
  [Reason.OVER_TAP_LIMIT]: 'Over the tap limit',
  [Reason.POOL_EMPTY]: 'Pool empty, try again',
};
