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
        d="M16 2.5C8.54 2.5 2.5 8.54 2.5 16c0 2.38.62 4.67 1.81 6.69L2.5 29.5l6.99-1.78A13.45 13.45 0 0 0 16 29.5c7.46 0 13.5-6.04 13.5-13.5S23.46 2.5 16 2.5Z"
        fill="currentColor"
      />
      <path
        d="M21.53 18.52c-.3-.15-1.77-.87-2.04-.97-.28-.1-.48-.15-.68.15-.2.3-.77.97-.94 1.17-.17.2-.35.23-.65.08-.3-.15-1.26-.47-2.4-1.49-.89-.8-1.5-1.78-1.67-2.08-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.03-.53-.08-.15-.67-1.63-.92-2.23-.24-.59-.49-.51-.67-.52l-.58-.01c-.2 0-.52.08-.8.38-.28.3-1.05 1.02-1.05 2.5 0 1.48 1.08 2.91 1.23 3.11.15.2 2.13 3.24 5.14 4.54.72.31 1.28.5 1.71.63.72.23 1.38.2 1.9.12.58-.09 1.79-.72 2.04-1.42.25-.7.25-1.3.18-1.43-.08-.12-.28-.2-.58-.35Z"
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
        bottom-4
        right-4
        z-50
        flex
        size-12
        items-center
        justify-center
        rounded-full
        bg-[#25D366]
        text-white
        shadow-lg
        shadow-[#25D366]/30
        transition-transform
        hover:scale-105
        animate-[whatsapp-float_2.8s_ease-in-out_infinite]
        sm:bottom-6
        sm:right-6
        sm:size-auto
        sm:gap-2
        sm:px-4
        sm:py-3
      "
    >
      <WhatsAppIcon className="size-6 sm:size-7" />
      <span className="hidden text-sm font-semibold sm:inline sm:text-base">
        WhatsApp
      </span>
    </a>
  )
}
