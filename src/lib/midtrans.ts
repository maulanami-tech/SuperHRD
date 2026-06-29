import { createHash } from "crypto";
import midtransClient from "midtrans-client";
import { timingSafeEqual } from "@/lib/crypto-utils";

type MidtransAction = {
  name?: string;
  method?: string;
  url?: string;
};

type MidtransPaymentLinkStatusResponse = {
  usage?: number;
  usage_limit?: number;
  usage_status?: string;
  merchant_id?: string;
  transaction_details?: {
    order_id?: string;
    gross_amount?: number;
    payment_link_id?: string;
  };
  expiry?: {
    start_time?: string;
    duration?: number;
    unit?: string;
  };
  payment_link_type?: string;
  purchase_history?: Array<{
    order_id?: string;
    expiry_time?: string;
    transaction_id?: string;
    transaction_status?: string;
    payment_type?: string;
    amount_value?: number;
    amount_currency?: string;
    acquirer?: string;
  }>;
  error_messages?: string[];
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
  paymentUrl: string | null;
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

function getMidtransApiBaseUrl(): string {
  return process.env.MIDTRANS_IS_PRODUCTION === "true"
    ? "https://api.midtrans.com"
    : "https://api.sandbox.midtrans.com";
}

function getBasicAuthHeader(serverKey: string): string {
  return `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`;
}

export function createMidtransOrderId(topupId: string): string {
  const normalized = topupId.replace(/[^a-zA-Z0-9]/g, "").slice(-12);
  const timestamp = Date.now().toString().slice(-10);
  return `SHRD${normalized}${timestamp}`;
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

function extractPaymentLinkUrl(response: Record<string, unknown>): string | null {
  const candidates = [
    response.payment_url,
    response.paymentUrl,
    response.redirect_url,
    response.url,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return null;
}

export async function createPaymentLink(params: {
  orderId: string;
  grossAmount: number;
  customer: {
    firstName: string;
    email: string;
  };
}): Promise<QrisChargeResult> {
  const serverKey = getMidtransServerKey();
  const appUrl = process.env.APP_URL?.replace(/\/$/, "");
  const response = await fetch(`${getMidtransApiBaseUrl()}/v1/payment-links`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: getBasicAuthHeader(serverKey),
    },
    body: JSON.stringify({
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
      usage_limit: 1,
      expiry: {
        duration: 30,
        unit: "minutes",
      },
      callbacks: appUrl
        ? {
            finish: `${appUrl}/topup`,
          }
        : undefined,
    }),
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const errorMessages = Array.isArray(payload.error_messages)
      ? payload.error_messages.find((item): item is string => typeof item === "string")
      : null;
    const message =
      errorMessages ||
      (typeof payload.status_message === "string" ? payload.status_message : null) ||
      "Failed to create Midtrans Payment Link";
    throw new Error(message);
  }

  const paymentUrl = extractPaymentLinkUrl(payload);

  return {
    orderId: params.orderId,
    transactionId: getString(payload.transaction_id),
    providerStatus: getString(payload.transaction_status) ?? "pending",
    providerPayload: payload,
    qrCodeUrl: paymentUrl,
    qrString: null,
    paymentUrl,
  };
}

export async function fetchMidtransPaymentLinkStatus(
  orderId: string,
): Promise<MidtransPaymentLinkStatusResponse> {
  const serverKey = getMidtransServerKey();
  const response = await fetch(`${getMidtransApiBaseUrl()}/v1/payment-links/${orderId}/status`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: getBasicAuthHeader(serverKey),
    },
  });

  const payload = (await response.json()) as MidtransPaymentLinkStatusResponse;

  if (!response.ok) {
    const message = payload.error_messages?.[0] ?? "Failed to fetch Midtrans Payment Link status";
    throw new Error(message);
  }

  return payload;
}

export function mapPaymentLinkStatusToNotification(
  orderId: string,
  status: MidtransPaymentLinkStatusResponse,
): MidtransNotification | null {
  const latestPurchase = status.purchase_history?.[status.purchase_history.length - 1];
  if (latestPurchase?.transaction_status) {
    return {
      order_id: orderId,
      transaction_id: latestPurchase.transaction_id,
      transaction_status: latestPurchase.transaction_status.toLowerCase(),
      fraud_status:
        latestPurchase.transaction_status.toLowerCase() === "capture" ||
        latestPurchase.transaction_status.toLowerCase() === "settlement"
          ? "accept"
          : undefined,
      status_code: "200",
      gross_amount: String(
        latestPurchase.amount_value ?? status.transaction_details?.gross_amount ?? 0,
      ),
      payment_type: latestPurchase.payment_type?.toLowerCase(),
    };
  }

  const usageStatus = status.usage_status?.toUpperCase();
  if (usageStatus === "EXPIRED") {
    return {
      order_id: orderId,
      transaction_status: "expire",
      status_code: "200",
      gross_amount: String(status.transaction_details?.gross_amount ?? 0),
    };
  }

  return null;
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
    paymentUrl: null,
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
