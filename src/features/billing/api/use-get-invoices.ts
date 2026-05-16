import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

interface UseGetInvoicesProps {
    billingAccountId?: string;
    userId?: string;
    organizationId?: string;
    status?: string;
    limit?: number;
    offset?: number;
    enabled?: boolean;
}

/**
 * Fetch invoices from the billing feature
 * Supports userId for personal accounts and organizationId for org accounts
 */
export const useGetInvoices = ({
    billingAccountId,
    userId,
    organizationId,
    status,
    limit = 24,
    offset = 0,
    enabled = true,
}: UseGetInvoicesProps) => {
    const query = useQuery({
        queryKey: ["billing-invoices", { billingAccountId, userId, organizationId, status, limit, offset }],
        queryFn: async () => {
            const response = await client.api.billing.invoices.$get({
                query: {
                    billingAccountId: billingAccountId || undefined,
                    userId: userId || undefined,
                    organizationId: organizationId || undefined,
                    status: status || undefined,
                    limit: limit.toString(),
                    offset: offset.toString(),
                },
            });

            if (!response.ok) {
                throw new Error("Failed to fetch billing invoices");
            }

            const { data } = await response.json();
            return data;
        },
        enabled: enabled && (!!billingAccountId || !!userId || !!organizationId),
    });

    return query;
};
