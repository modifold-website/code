import axios from "axios";

export const apiClient = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_BASE,
    headers: {
        Accept: "application/json",
    },
});

export const getAuthToken = (authToken) => {
    if(authToken) {
        return authToken;
    }

    if(typeof window === "undefined") {
        return null;
    }

    return localStorage.getItem("authToken");
};

export const getAuthHeaders = (authToken) => {
    const token = getAuthToken(authToken);
    return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getErrorStatus = (error) => error?.response?.status;