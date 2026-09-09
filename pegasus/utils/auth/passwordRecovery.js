import { apiClient } from "@/utils/api/client";

export async function passwordRecoveryRequest(action, body) {
	try {
		const { data } = await apiClient.post(`/auth/password/recovery/${action}`, body);
		return data;
	} catch(error) {
		const code = error.response?.status === 429 ? "rate_limited" : error.response?.data?.code;
		const known = ["invalid_link", "invalid_email", "invalid_password", "password_too_long", "password_mismatch", "rate_limited"];
		throw new Error(known.includes(code) ? code : "generic");
	}
}