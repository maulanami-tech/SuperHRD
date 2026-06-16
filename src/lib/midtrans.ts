import { createHash } from "crypto";
import midtransClient from "midtrans-client";
import { timingSafeEqual } from "@/lib/crypto-utils";

type MidtransAction = {
  name?: string;
  method?: string;
  url?: string;
};

export type MidtransNotification = {
  order_id?: string;
  transaction_id?: string;
  transaction_status?: string;
  fraud_status?: string;
  status_code?: string;
  gross_amount?: string;
  signature_key?: string;
  payment_type?: string;
  [key: string]: unknown;
};

export type QrisChargeResult = {
  orderId: string;
  transactionId: string | null;
  providerStatus: string | null;
  providerPayload: Record<string, unknown>;
  qrCodeUrl: string | null;
  qrString: string | null;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export function getMidtransServerKey(): string {
  return requiredEnv("MIDTRANS_SERVER_KEY");
}

export function createMidtransCoreApi() {
  const coreApi = new midtransClient.CoreApi({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
    serverKey: getMidtransServerKey(),
    clientKey: process.env.MIDTRANS_CLIENT_KEY,
  });

  const notificationUrl = getNotificationUrl();
  if (notificationUrl) {
    coreApi.httpClient.http_client.defaults.headers.common["X-Override-Notification"] =
      notificationUrl;
  }

  return coreApi;
}

export function createMidtransOrderId(topupId: string): string {
  return `SUPERHRD-${topupId}-${Date.now()}`;
}

function getNotificationUrl(): string | undefined {
  if (process.env.MIDTRANS_NOTIFICATION_URL) {
    return process.env.MIDTRANS_NOTIFICATION_URL;
  }

  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    return undefined;
  }

  return `${appUrl.replace(/\/$/, "")}/api/payments/midtrans/notification`;
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function extractQrCodeUrl(actions: unknown): string | null {
  if (!Array.isArray(actions)) {
    return null;
  }

  const action = (actions as MidtransAction[]).find((item) => {
    const name = item.name?.toLowerCase() ?? "";
    return name.includes("qr") && !!item.url;
  });

  return action?.url ?? null;
}

export async function createQrisCharge(params: {
  orderId: string;
  grossAmount: number;
  customer: {
    firstName: string;
    email: string;
  };
}): Promise<QrisChargeResult> {
  const coreApi = createMidtransCoreApi();

  const chargePayload: Record<string, unknown> = {
    payment_type: "qris",
    transaction_details: {
      order_id: params.orderId,
      gross_amount: params.grossAmount,
    },
    item_details: [
      {
        id: params.orderId,
        price: params.grossAmount,
        quantity: 1,
        name: "SuperHRD credit top-up",
      },
    ],
    customer_details: {
      first_name: params.customer.firstName,
      email: params.customer.email,
    },
    qris: {
      acquirer: "gopay",
    },
  };

  const response = await coreApi.charge(chargePayload);

  return {
    orderId: params.orderId,
    transactionId: getString(response.transaction_id),
    providerStatus: getString(response.transaction_status),
    providerPayload: response,
    qrCodeUrl: extractQrCodeUrl(response.actions),
    qrString: getString(response.qr_string),
  };
}

export function verifyMidtransSignature(notification: MidtransNotification): boolean {
  const { order_id, status_code, gross_amount, signature_key } = notification;
  if (!order_id || !status_code || !gross_amount || !signature_key) {
    return false;
  }

  const expected = createHash("sha512")
    .update(`${order_id}${status_code}${gross_amount}${getMidtransServerKey()}`)
    .digest("hex");

  return timingSafeEqual(signature_key, expected);
}

export async function parseMidtransNotification(
  notification: MidtransNotification,
): Promise<MidtransNotification> {
  const coreApi = createMidtransCoreApi();
  const parsed = await coreApi.transaction.notification(notification);
  return parsed as MidtransNotification;
}
