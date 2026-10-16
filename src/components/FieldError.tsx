import './FieldError.css';
export function FieldError({id,message}:{id:string;message?:string}) {
 return message?<span id={id} className="nesmi-field-error"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 3v1"/></svg><span>{message}</span></span>:null;
}
