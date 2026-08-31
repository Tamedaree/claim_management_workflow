import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";

/**
 * @typedef {Object} PasswordInputProps
 * @property {string} [id]
 * @property {string} [autoComplete]
 * @property {string} [placeholder]
 * @property {string} value
 * @property {(e: import('react').ChangeEvent<HTMLInputElement>) => void} onChange
 * @property {string} [className]
 * @property {boolean} [autoFocus]
 * @property {(capsLockOn: boolean) => void} [onCapsLock]
 */

/**
 * @param {PasswordInputProps} props
 */
export default function PasswordInput({ id, autoComplete, placeholder, value, onChange, className, autoFocus = false, onCapsLock, ...props }) {
  const [show, setShow] = useState(false);

  /**
   * @param {import('react').KeyboardEvent<HTMLInputElement>} e
   */
  const handleKeyUp = (e) => {
    if (onCapsLock) {
      onCapsLock(e.getModifierState && e.getModifierState("CapsLock"));
    }
  };

  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyUp={handleKeyUp}
        className={className}
        autoFocus={autoFocus}
        required
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}