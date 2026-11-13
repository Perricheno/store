export function availableJobTypes(paymentReady: boolean, mailReady: boolean): string[] {
  return [
    ...(paymentReady ? ["create_invoice", "create_wallet_topup_invoice"] : []),
    ...(mailReady ? ["send_mail"] : []),
  ];
}
