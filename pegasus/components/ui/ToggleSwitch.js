export default function ToggleSwitch({ checked, onChange, label, id, className = "" }) {
	return (
		<button id={id} type="button" className={`toggle-switch ${checked ? "is-active" : ""} ${className}`.trim()} role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}>
			<span className="toggle-switch__thumb" aria-hidden="true" />
		</button>
	);
}