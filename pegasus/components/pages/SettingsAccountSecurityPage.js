"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "../providers/AuthProvider";
import DeleteAccountSection from "../DeleteAccountSection";
import TwoFactorSetupModal from "@/modal/TwoFactorSetupModal";
import TwoFactorDisableModal from "@/modal/TwoFactorDisableModal";
import ChangePasswordModal from "@/modal/ChangePasswordModal";
import ConfirmModal from "@/modal/ConfirmModal";
import { useAuthProviders, useDisconnectAuthProvider, useStartAuthProviderLink } from "@/utils/authProviders/hooks";

const AUTH_PROVIDERS = [
	{
		id: "hytale",
		name: "Hytale",
		path: "M13.7023 0.0130647V7.89884L10.3939 7.8908L10.3284 0L4 0.934093L6.017 4.71971L6.01898 17.2619L10.3761 20.4696L10.3786 11.685L13.6428 11.6985V24L17.9775 20.8063V4.72373L20 0.944142L13.7023 0.0130647Z",
	},
	{
		id: "github",
		name: "GitHub",
		path: "M12 0C5.373 0 0 5.373 0 12C0 17.302 3.438 21.8 8.207 23.387C8.807 23.498 9 23.126 9 22.81V20.576C5.662 21.302 4.967 19.16 4.967 19.16C4.421 17.773 3.634 17.403 3.634 17.403C2.544 16.658 3.717 16.674 3.717 16.674C4.922 16.758 5.555 17.911 5.555 17.911C6.625 19.745 8.362 19.215 9.047 18.908C9.155 18.133 9.465 17.603 9.809 17.303C7.144 16.998 4.342 15.969 4.342 11.371C4.342 10.06 4.811 8.99 5.578 8.15C5.454 7.847 5.043 6.626 5.695 4.974C5.695 4.974 6.703 4.652 8.996 6.204C9.975 5.939 10.985 5.804 12 5.803C13.02 5.808 14.047 5.941 15.006 6.207C17.297 4.655 18.303 4.977 18.303 4.977C18.956 6.63 18.545 7.851 18.421 8.153C19.191 8.993 19.656 10.063 19.656 11.374C19.656 15.983 16.849 16.998 14.177 17.295C14.607 17.667 15 18.397 15 19.517V22.81C15 23.129 15.192 23.504 15.801 23.386C20.566 21.797 24 17.3 24 12C24 5.373 18.627 0 12 0Z",
	},
	{
		id: "discord",
		name: "Discord",
		path: "M20.3175 4.36988C18.7615 3.65581 17.1195 3.14656 15.4325 2.85488C15.4011 2.849 15.3695 2.864 15.3535 2.89188C15.1435 3.26688 14.9095 3.75588 14.7455 4.14188C12.9269 3.86612 11.0771 3.86612 9.25848 4.14188C9.07532 3.71448 8.86935 3.29721 8.64148 2.89188C8.62448 2.86488 8.59448 2.84988 8.56248 2.85488C6.87523 3.14546 5.23306 3.65475 3.67748 4.36988C3.66503 4.37652 3.65412 4.38572 3.64548 4.39688C0.533481 9.04588 -0.319519 13.5799 0.0994806 18.0569C0.101481 18.0809 0.112481 18.1009 0.130481 18.1139C1.94208 19.4561 3.96859 20.4807 6.12348 21.1439C6.15448 21.1519 6.18548 21.1409 6.20748 21.1159C6.66948 20.4859 7.08148 19.8209 7.43348 19.1219C7.44948 19.0899 7.43648 19.0509 7.39248 19.0159C6.74572 18.7689 6.11973 18.4706 5.52048 18.1239C5.47748 18.0989 5.47348 18.0299 5.51248 17.9959C5.63877 17.9015 5.7628 17.8041 5.88448 17.7039C5.90948 17.6819 5.94548 17.6779 5.96148 17.6939C9.88948 19.4869 14.1415 19.4869 18.0235 17.6939C18.0505 17.6799 18.0805 17.6839 18.1015 17.7039C18.2215 17.8019 18.3475 17.9019 18.4745 17.9959C18.5145 18.0259 18.5105 18.0959 18.4685 18.1229C17.8704 18.4724 17.2438 18.7708 16.5955 19.0149C16.5525 19.0309 16.5415 19.0899 16.5545 19.1219C16.9145 19.8199 17.3265 20.4839 17.7795 21.1149C17.8005 21.1409 17.8325 21.1509 17.8635 21.1429C20.0223 20.4824 22.0522 19.4577 23.8655 18.1129C23.8835 18.0999 23.8955 18.0809 23.8975 18.0589C24.3975 12.8819 23.0595 8.38488 20.3485 4.39888C20.3422 4.38538 20.3312 4.37569 20.3175 4.36988ZM8.02048 15.3299C6.83848 15.3299 5.86348 14.2449 5.86348 12.9109C5.86348 11.5779 6.81948 10.4919 8.02048 10.4919C9.23048 10.4919 10.1965 11.5879 10.1775 12.9119C10.1775 14.2449 9.22148 15.3299 8.02048 15.3299ZM15.9955 15.3299C14.8125 15.3299 13.8385 14.2449 13.8385 12.9109C13.8385 11.5779 14.7935 10.4919 15.9955 10.4919C17.2055 10.4919 18.1715 11.5879 18.1525 12.9119C18.1525 14.2449 17.2065 15.3299 15.9955 15.3299Z",
	},
	{
		id: "telegram",
		name: "Telegram",
		path: "M12 1.5C17.799 1.5 22.5 6.20101 22.5 12C22.5 17.799 17.799 22.5 12 22.5C6.20101 22.5 1.5 17.799 1.5 12C1.5 6.20101 6.20101 1.5 12 1.5ZM17.2402 7.65625C17.3334 7.05232 16.7587 6.57574 16.2217 6.81152L5.52344 11.5088C5.13847 11.6782 5.16698 12.2615 5.56641 12.3887L7.77246 13.0908C8.19357 13.2249 8.64987 13.1554 9.01758 12.9014L13.9912 9.46484C14.1412 9.36146 14.3048 9.575 14.1768 9.70703L10.5957 13.3984C10.2487 13.7565 10.3178 14.363 10.7354 14.625L14.7441 17.1396C15.1937 17.4214 15.7723 17.138 15.8564 16.5947L17.2402 7.65625Z",
	},
];

const getProviderActionErrorCode = (error) => error?.response?.data?.code || "generic";

const normalizeTimestamp = (value) => {
	const timestamp = Number(value);
	if(!Number.isFinite(timestamp) || timestamp <= 0) {
		return null;
	}

	return timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
};

export default function SettingsAccountSecurityPage({ initialUser = null, initialTwoFactor = null, initialPassword = null, initialProviders = null, authToken = null }) {
	const t = useTranslations("SettingsBlogPage");
	const locale = useLocale();
	const { isLoggedIn, user } = useAuth();
	const router = useRouter();
	const effectiveUser = user || initialUser;
	const [twoFactorEnabled, setTwoFactorEnabled] = useState(Boolean(initialTwoFactor?.enabled));
	const [passwordEnabled, setPasswordEnabled] = useState(Boolean(initialPassword?.enabled));
	const [isPasswordOpen, setIsPasswordOpen] = useState(false);
	const [isSetupOpen, setIsSetupOpen] = useState(false);
	const [isDisableOpen, setIsDisableOpen] = useState(false);
	const [pendingDisconnectProvider, setPendingDisconnectProvider] = useState(null);
	const [providerActionError, setProviderActionError] = useState("");
	const token = authToken || (typeof window !== "undefined" ? localStorage.getItem("authToken") : null);
	const providersQuery = useAuthProviders({ authToken: token, initialData: initialProviders });
	const startProviderLink = useStartAuthProviderLink({ authToken: token });
	const disconnectProvider = useDisconnectAuthProvider({ authToken: token });
	const providerStatus = providersQuery.data?.providers || {};
	const pendingProvider = AUTH_PROVIDERS.find((provider) => provider.id === pendingDisconnectProvider) || null;

	useEffect(() => {
		if(!isLoggedIn && !initialUser) {
			router.push("/403");
		}
	}, [initialUser, isLoggedIn, router]);

	if(!isLoggedIn && !effectiveUser) {
		return null;
	}

	const handleRefreshStatus = async () => {
		try {
			const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/auth/2fa/status`, {
				headers: { Authorization: `Bearer ${token}` },
			});

			const data = await res.json().catch(() => ({}));
			if(res.ok) {
				setTwoFactorEnabled(Boolean(data?.enabled));
			}
		} catch {}
	};

	const handleRefreshPasswordStatus = async () => {
		try {
			const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/auth/password/status`, {
				headers: { Authorization: `Bearer ${token}` },
			});

			const data = await res.json().catch(() => ({}));
			if(res.ok) {
				setPasswordEnabled(Boolean(data?.enabled));
			}
		} catch {}
	};

	useEffect(() => {
		if(initialTwoFactor === null) {
			handleRefreshStatus();
		}
	}, [initialTwoFactor]);

	useEffect(() => {
		if(initialPassword === null) {
			handleRefreshPasswordStatus();
		}
	}, [initialPassword]);

	const formatConnectedAt = (value) => {
		const timestamp = normalizeTimestamp(value);
		if(!timestamp) {
			return t("authProviders.connected");
		}

		return t("authProviders.connectedAt", {
			date: new Intl.DateTimeFormat(locale, {
				day: "numeric",
				month: "long",
				...(new Date(timestamp).getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
			}).format(new Date(timestamp)),
		});
	};

	const getProviderError = (error) => {
		const code = getProviderActionErrorCode(error);
		if(code === "last_login_method") {
			return t("authProviders.errors.lastLoginMethod");
		}
		if(code === "provider_already_connected") {
			return t("authProviders.errors.alreadyConnected");
		}
		if(code === "provider_not_connected") {
			return t("authProviders.errors.notConnected");
		}

		return t("authProviders.errors.generic");
	};

	const handleLinkProvider = async (provider) => {
		if(!token || startProviderLink.isPending) {
			return;
		}

		try {
			setProviderActionError("");
			const data = await startProviderLink.mutateAsync({
				provider,
				next: "/settings/account-security",
			});
			if(!data?.url) {
				throw new Error("Provider authorization URL is missing");
			}

			window.location.assign(data.url);
		} catch (error) {
			setProviderActionError(getProviderError(error));
		}
	};

	const handleDisconnectProvider = async () => {
		if(!pendingDisconnectProvider || disconnectProvider.isPending) {
			return;
		}

		try {
			setProviderActionError("");
			await disconnectProvider.mutateAsync({ provider: pendingDisconnectProvider });
			setPendingDisconnectProvider(null);
		} catch (error) {
			setProviderActionError(getProviderError(error));
			setPendingDisconnectProvider(null);
		}
	};

	return (
		<>
			<div className="settings-wrapper--narrow">
				<div className="settings-wrapper blog-settings">
					<div className="blog-settings__body">
						<p className="blog-settings__field-title">{t("accountSecurity.title")}</p>
						<p className="settings-security-description">{t("accountSecurity.description")}</p>

						{passwordEnabled ? (
							<form className="settings-twofactor-card">
								<div>
									<div className="settings-twofactor-title">{t("passwordChange.title")}</div>
									<div className="settings-twofactor-description">{t("passwordChange.description")}</div>
								</div>

								<button type="button" className="button button--size-m button--with-icon button--type-minimal" onClick={() => setIsPasswordOpen(true)}>
									<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-key-round-icon lucide-key-round">
										<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/>
										<circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/>
									</svg>

									{t("passwordChange.submit")}
								</button>
							</form>
						) : null}

						<div className="settings-twofactor-card">
							<div>
								<div className="settings-twofactor-title">{t("twoFactor.title")}</div>
								<div className="settings-twofactor-description">{t("twoFactor.description")}</div>
							</div>

							{twoFactorEnabled ? (
								<button type="button" className="button button--size-m button--with-icon button--type-minimal" onClick={() => setIsDisableOpen(true)}>
									<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shield-minus-icon lucide-shield-minus">
										<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
										<path d="M9 12h6"/>
									</svg>

									{t("twoFactor.disable")}
								</button>
							) : (
								<button type="button" className="button button--size-m button--with-icon button--type-minimal" onClick={() => setIsSetupOpen(true)}>
									<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-plus-icon lucide-plus">
										<path d="M5 12h14"/>
										<path d="M12 5v14"/>
									</svg>

									{t("twoFactor.enable")}
								</button>
							)}
						</div>

						<p className="blog-settings__field-title settings-auth-providers__title">{t("authProviders.title")}</p>
						<p className="settings-auth-providers__description">{t("authProviders.description")}</p>

						{providersQuery.isError || providerActionError ? (
							<p className="settings-auth-providers__error" role="alert">
								{providerActionError || t("authProviders.errors.load")}
							</p>
						) : null}

						<div className="settings-auth-providers" aria-busy={providersQuery.isLoading}>
							{AUTH_PROVIDERS.map((provider) => {
								const status = providerStatus[provider.id];
								const connected = Boolean(status?.connected);
								const isLinking = startProviderLink.isPending && startProviderLink.variables?.provider === provider.id;
								const isDisconnecting = disconnectProvider.isPending && disconnectProvider.variables?.provider === provider.id;

								return (
									<div className="settings-auth-provider" key={provider.id}>
										<div className={`settings-auth-provider__icon settings-auth-provider__icon--${provider.id}`} aria-hidden="true">
											<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
												<path d={provider.path} fill="currentColor"/>
											</svg>
										</div>

										<div className="settings-auth-provider__copy">
											<div className="settings-auth-provider__name">{provider.name}</div>

											<div className="settings-auth-provider__status">
												{providersQuery.isLoading ? t("authProviders.loading") : connected ? (
													<>
												{status?.account_name ? (
													<span className="settings-auth-provider__account-name">
														<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
															<circle cx="12" cy="8" r="5"/>
															<path d="M20 21a8 8 0 0 0-16 0"/>
														</svg>

														{status.account_name}
													</span>
												) : null}
												<span className="settings-auth-provider__connected-at">
													<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
														<path d="M12 6v6l4 2"/>
														<circle cx="12" cy="12" r="9"/>
													</svg>

													{formatConnectedAt(status?.connected_at)}
												</span>
											</>
												) : t("authProviders.notConnected")}
											</div>

											{connected && status?.can_disconnect === false ? (
												<div className="settings-auth-provider__hint">{t("authProviders.onlyLoginMethod")}</div>
											) : null}
										</div>

										{connected ? (
											<button type="button" className="button button--size-m button--type-negative settings-auth-provider__action" onClick={() => setPendingDisconnectProvider(provider.id)} disabled={providersQuery.isLoading || isDisconnecting || status?.can_disconnect === false}>
												{isDisconnecting ? t("authProviders.disconnecting") : t("authProviders.disconnect")}
											</button>
										) : (
											<button type="button" className="button button--size-m button--type-positive settings-auth-provider__action" onClick={() => handleLinkProvider(provider.id)} disabled={providersQuery.isLoading || startProviderLink.isPending}>
												{isLinking ? t("authProviders.connecting") : t("authProviders.connect")}
											</button>
										)}
									</div>
								);
							})}
						</div>
					</div>
				</div>

				<DeleteAccountSection />
			</div>

			<TwoFactorSetupModal
				isOpen={isSetupOpen}
				authToken={token}
				onRequestClose={() => setIsSetupOpen(false)}
				onEnabled={() => {
					setIsSetupOpen(false);
					setTwoFactorEnabled(true);
				}}
			/>

			<TwoFactorDisableModal
				isOpen={isDisableOpen}
				authToken={token}
				onRequestClose={() => setIsDisableOpen(false)}
				onDisabled={() => {
					setIsDisableOpen(false);
					handleRefreshStatus();
				}}
			/>

			<ChangePasswordModal
				isOpen={isPasswordOpen}
				authToken={token}
				onRequestClose={() => setIsPasswordOpen(false)}
			/>

			<ConfirmModal
				isOpen={Boolean(pendingProvider)}
				title={pendingProvider ? t("authProviders.confirm.title", { provider: pendingProvider.name }) : ""}
				description={pendingProvider ? t("authProviders.confirm.description", { provider: pendingProvider.name }) : ""}
				confirmLabel={disconnectProvider.isPending ? t("authProviders.disconnecting") : t("authProviders.disconnect")}
				cancelLabel={t("authProviders.confirm.cancel")}
				isLoading={disconnectProvider.isPending}
				onConfirm={handleDisconnectProvider}
				onRequestClose={() => {
					if(!disconnectProvider.isPending) {
						setPendingDisconnectProvider(null);
					}
				}}
			/>
		</>
	);
}
