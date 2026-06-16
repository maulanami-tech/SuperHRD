declare module "midtrans-client" {
  export interface CoreApiOptions {
    isProduction: boolean;
    serverKey: string;
    clientKey?: string;
  }

  export class CoreApi {
    httpClient: {
      http_client: {
        defaults: {
          headers: {
            common: Record<string, string>;
          };
        };
      };
    };
    constructor(options: CoreApiOptions);
    charge(parameter: Record<string, unknown>): Promise<Record<string, unknown>>;
    transaction: {
      notification(notification: Record<string, unknown>): Promise<Record<string, unknown>>;
      status(transactionId: string): Promise<Record<string, unknown>>;
    };
  }

  const midtransClient: {
    CoreApi: typeof CoreApi;
  };

  export default midtransClient;
}
