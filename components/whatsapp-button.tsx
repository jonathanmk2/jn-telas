import { whatsappLink } from '@/lib/format'

function WhatsAppIcon({
  className = 'size-7',
}: {
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M16 3C8.82 3 3 8.82 3 16c0 2.28.6 4.43 1.65 6.3L3 29l6.88-1.6A12.94 12.94 0 0 0 16 29c7.18 0 13-5.82 13-13S23.18 3 16 3Z"
        fill="currentColor"
      />

      <path
        d="M21.48 18.73c-.3-.15-1.78-.87-2.05-.97-.28-.1-.48-.15-.68.15-.2.3-.77.97-.95 1.17-.17.2-.35.23-.65.08-.3-.15-1.27-.47-2.42-1.5-.89-.8-1.5-1.78-1.67-2.08-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.63-.92-2.23-.24-.58-.49-.51-.67-.52l-.58-.01c-.2 0-.52.08-.8.38-.27.3-1.05 1.02-1.05 2.5 0 1.47 1.08 2.9 1.23 3.1.15.2 2.12 3.23 5.12 4.53.72.31 1.28.5 1.71.63.72.23 1.37.2 1.89.12.58-.09 1.78-.72 2.03-1.42.25-.7.25-1.3.18-1.43-.08-.12-.28-.2-.58-.35Z"
        fill="white"
      />
    </svg>
  )
}

export function WhatsAppButton() {
  return (
    <a
      href={whatsappLink(
        'Olá! Tenho interesse nos planos da JN TELAS.',
      )}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      className="
        fixed
        bottom-5
        right-5
        z-50
        flex
        items-center
        justify-center
        gap-2
        rounded-full
        bg-[#25D366]
        px-4
        py-3
        font-medium
        text-white
        shadow-lg
        shadow-[#25D366]/30
        transition-transform
        hover:scale-105
        sm:bottom-6
        sm:right-6
      "
    >
      <WhatsAppIcon className="size-6 sm:size-7" />

      <span className="text-sm font-semibold sm:text-base">
        WhatsApp
      </span>
    </a>
  )
}
