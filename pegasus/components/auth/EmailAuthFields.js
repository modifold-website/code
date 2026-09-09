"use client";

export function EmailAuthField({ children }) {
	return (
		<div className="field field--large">
			<label className="field__wrapper">
				{children}
			</label>
		</div>
	);
}

export function PasswordField({ autoComplete, name, placeholder, value, onChange, showPassword, onToggle, t }) {
	return (
		<EmailAuthField>
			<input className="text-input" name={name} type={showPassword ? "text" : "password"} autoComplete={autoComplete} placeholder={placeholder} aria-label={placeholder} minLength={8} value={value} onChange={onChange} required />
			
			<button className="email-auth__password-toggle" type="button" onClick={onToggle} aria-label={showPassword ? t("hidePassword") : t("showPassword")}>
				{showPassword ? (
					<svg className="icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
						<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
						<path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
						<path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
						<path d="m2 2 20 20" />
					</svg>
				) : (
					<svg className="icon" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
						<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
				)}
			</button>
		</EmailAuthField>
	);
}