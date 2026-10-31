import { useId, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export function PasswordInput({ label = 'mật khẩu', className = '', id, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label?: string }) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [visible, setVisible] = useState(false);
  return <span className="relative block">
    <input {...props} id={inputId} type={visible ? 'text' : 'password'} className={`${className} pr-14`}/>
    <button type="button" aria-label={`${visible ? 'Ẩn' : 'Hiện'} ${label}`} aria-pressed={visible} aria-controls={inputId}
      onMouseDown={event => event.preventDefault()} onClick={() => setVisible(value => !value)}
      className="absolute inset-y-0 right-0 flex min-h-11 w-12 items-center justify-center rounded-r-lg text-slate-300 hover:text-film-warm focus-visible:outline focus-visible:outline-2 focus-visible:outline-film-warm">
      {visible ? <EyeOff size={19} aria-hidden="true"/> : <Eye size={19} aria-hidden="true"/>}
    </button>
  </span>;
}
