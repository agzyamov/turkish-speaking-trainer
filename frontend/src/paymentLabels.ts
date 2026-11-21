import type { Country, Method, PaymentStatus } from "./api/payments";

export const countryLabels: Record<Country, string> = { russia: "payment.russia", turkey: "payment.turkey", other: "payment.anotherCountry" };
export const methodLabels: Record<Method, string> = { sbp: "payment.sbp", alta: "ALTA Banka", paypal: "PayPal" };
export const statusLabels: Record<PaymentStatus, string> = {
  awaiting_payment: "payment.awaitingPayment",
  awaiting_review: "payment.awaitingVerification",
  confirmed: "payment.confirmed",
  rejected: "payment.rejected",
  cancelled: "payment.cancelled",
};
