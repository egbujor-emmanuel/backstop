/** The message a wallet signs to request a starter kit. Shared by the app and /api/starter. */
export function starterMessage(address: string): string {
  return `BACKSTOP starter kit for ${address.toLowerCase()} on Mezo testnet (chain 31611)`;
}
