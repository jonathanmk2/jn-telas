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
        d="M16 2.75C8.68 2.75 2.75 8.68 2.75 16c0 2.34.61 4.55 1.78 6.5L2.7 29.3l6.97-1.8A13.16 13.16 0 0 0 16 29.25c7.32 0 13.25-5.93 13.25-13.25S23.32 2.75 16 2.75Z"
        fill="currentColor"
      />
      <path
        d="M21.45 18.55c-.3-.15-1.76-.86-2.03-.96-.27-.1-.47-.15-.67.15-.2.3-.76.96-.93 1.16-.17.2-.34.22-.64.07-.3-.15-1.25-.46-2.39-1.48-.89-.79-1.49-1.76-1.66-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.34.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.03 1-1.03 2.46s1.07 2.87 1.22 3.07c.15.2 2.1 3.19 5.07 4.48.71.31 1.27.5 1.69.63.71.22 1.36.19 1.87.11.57-.09 1.76-.71 2.01-1.4.25-.69.25-1.28.17-1.4-.07-.12-.27-.2-.57-.35Z"
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
