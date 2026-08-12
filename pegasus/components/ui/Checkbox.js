export default function Checkbox({ checked, onChange, children, ariaLabel, className = "" }) {
	return (
		<button className={`checkbox-control ${className}`.trim()} type="button" role="checkbox" aria-checked={checked} aria-label={ariaLabel} onClick={() => onChange(!checked)}>
			<span className={`checkbox-control__box ${checked ? "checkbox-control__box--checked" : ""}`} aria-hidden="true">
				{checked && (
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24">
						<path d="M20 6 9 17l-5-5" />
					</svg>
				)}
			</span>
			
			<span>{children}</span>
		</button>
	);
}