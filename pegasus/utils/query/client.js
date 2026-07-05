import { QueryClient } from "@tanstack/react-query";
import { getErrorStatus } from "@/utils/api/client";

export function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60 * 1000,
                refetchOnWindowFocus: false,
                retry: (failureCount, error) => {
                    const status = getErrorStatus(error);
                    if(status >= 400 && status < 500) {
                        return false;
                    }

                    return failureCount < 2;
                },
            },
        },
    });
}