export default function NeuraBrand({ size = 26, showText = true }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" className="shrink-0">
        <rect width="32" height="32" rx="10" fill="#111318" stroke="#1F242F" />
        <path d="M8 10h6l4 6 4-6h6M8 22h6l4-6 4 6h6" stroke="#6C7CFF" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="14" cy="16" r="1.7" fill="#6C7CFF" />
        <circle cx="18" cy="16" r="1.7" fill="#6C7CFF" />
      </svg>
      {showText && (
        <span className="text-[15px] font-bold tracking-[0.14em] text-neura-hi">NEURA</span>
      )}
    </div>
  );
}
