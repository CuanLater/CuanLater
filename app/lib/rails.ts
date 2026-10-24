// Mirrors CuanLater.Rail.
export enum Rail {
  CARD = 0,
  QRIS = 1,
}
export const railOf = (r: 'card' | 'qris') => (r === 'qris' ? Rail.QRIS : Rail.CARD);
export const railLabel = (r: Rail) => (r === Rail.QRIS ? 'QRIS' : 'card tap');
