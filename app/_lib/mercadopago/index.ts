import crypto from "crypto";
import { MercadoPagoConfig, Payment, Preference } from "mercadopago";

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
});

export const paymentClient = new Payment(client);
export const preferenceClient = new Preference(client);

export async function createCardPayment({
  amount,
  token,
  email,
  installments,
  paymentMethodId,
  issuerId,
}: {
  amount: number;
  token: string;
  email: string;
  installments: number;
  paymentMethodId: string;
  issuerId?: string;
}) {

  const payment = await paymentClient.create({
    body: {
      transaction_amount: amount,
      token: token,
      installments: installments,
      payment_method_id: paymentMethodId,
      issuer_id: issuerId ? parseInt(issuerId) : undefined,
      payer: {
        email: email,
      },
    },
    requestOptions: {
      idempotencyKey: crypto.randomUUID(),
    },
  });

  return {
    paymentId: payment.id,
    status: payment.status,
  };
}

interface CreateCardPaymentInput {
  amount: number;
  token: string;
  email: string;
  installments: number;
  paymentMethodId: string;
  issuerId?: string;
}
interface CreatePixPaymentInput {
  amount: number;
  reference: string;
  name: string;
  areaCode?: string;
  phoneNumber?: string;
}

export async function createPixPayment({
  amount,
  reference,
  name,
  areaCode,
  phoneNumber,
}: CreatePixPaymentInput) {
  if (!process.env.APP_URL) throw new Error("APP_URL nao definida");
  if (!/^https?:\/\/.+/.test(process.env.APP_URL)) throw new Error("APP_URL invalida");

  const isLocalhost =
    process.env.APP_URL.includes("localhost") || process.env.APP_URL.includes("127.0.0.1");
  const notificationUrl = isLocalhost
    ? undefined
    : `${process.env.APP_URL}/api/webhooks/mercadopago`;

  void areaCode;
  void phoneNumber;

  const paymentBody: {
    transaction_amount: number;
    description: string;
    payment_method_id: string;
    external_reference: string;
    notification_url?: string;
    payer: {
      email: string;
      first_name: string;
    };
  } = {
    transaction_amount: amount,
    description: "Inscricao campeonato",
    payment_method_id: "pix",
    external_reference: reference,
    payer: {
      email: "pagador@teste.com",
      first_name: name,
    },
  };

  if (notificationUrl) {
    paymentBody.notification_url = notificationUrl;
  }

  const payment = await paymentClient.create({
    body: paymentBody,
    requestOptions: { idempotencyKey: crypto.randomUUID() },
  });

  const transactionData = payment.point_of_interaction?.transaction_data;

  if (!transactionData) {
    console.error("Resposta completa MP:", payment);
    throw new Error(`PIX nao gerado. Status: ${payment.status || "undefined"}`);
  }

  return {
    paymentId: payment.id,
    status: payment.status,
    qrCode: transactionData.qr_code,
    qrCodeBase64: transactionData.qr_code_base64,
    pixCopyPaste: transactionData.qr_code,
    expiresAt: payment.date_of_expiration,
  };
}

export async function getPaymentStatus(paymentId: number) {
  const result = await paymentClient.get({ id: paymentId });
  return result;
}

export async function getPaymentById(paymentId: number) {
  const result = await paymentClient.get({ id: paymentId });
  return {
    id: result.id,
    status: result.status,
    external_reference: result.external_reference,
  };
}