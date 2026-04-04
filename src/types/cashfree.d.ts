
interface CashfreeCheckoutConfig {
    paymentSessionId: string;   // returned from createOrder API
    returnUrl?: string;         // optional redirect after payment
    redirectTarget?: "_modal" | "_self" | "_blank";
}

interface CashfreePaymentResponse {
    /** Error object if checkout failed or user dismissed the modal */
    error?: {
        message?: string;
        code?: string;
        type?: string;
    };
    /** Payment details if a payment attempt was made */
    paymentDetails?: {
        paymentMessage?: string;
        [key: string]: unknown;
    };
    /** Redirect info (only for non-modal flows) */
    redirect?: boolean;
}

interface CashfreeCheckoutInstance {
    checkout: (config: CashfreeCheckoutConfig) => Promise<CashfreePaymentResponse>;
}

interface Window {
    Cashfree: (config: { mode: "sandbox" | "production" }) => CashfreeCheckoutInstance;
}
