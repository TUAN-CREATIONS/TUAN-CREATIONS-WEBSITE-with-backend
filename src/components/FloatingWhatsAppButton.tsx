import { useSiteConfig } from "../hooks/useSiteConfig";

const WHATSAPP_MESSAGE = "Hello, TUAN Creations. I need your assistance:";

export default function FloatingWhatsAppButton() {
  const [config] = useSiteConfig();
  const whatsappNumber = config["social.whatsapp"] || "256753414058";

  return (
    <a
      className="whatsapp-float"
      href={`https://wa.me/${String(whatsappNumber).replace(/[^0-9]/g, "")}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      title="Chat with us on WhatsApp"
    >
      <span className="whatsapp-float__icon" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="currentColor" role="presentation" focusable="false">
          <path d="M12.04 2C6.55 2 2.09 6.46 2.09 11.95c0 1.76.46 3.47 1.33 4.98L2 22l5.23-1.37a9.89 9.89 0 0 0 4.81 1.23c5.49 0 9.95-4.46 9.95-9.95S17.53 2 12.04 2zm0 18.08c-1.48 0-2.92-.39-4.18-1.12l-.3-.18-3.1.81.83-3.02-.2-.31a8.13 8.13 0 1 1 6.95 3.82zm4.49-6.09c-.25-.12-1.49-.74-1.72-.82-.23-.09-.4-.12-.57.12-.17.25-.66.82-.81.99-.15.17-.3.19-.55.06-.25-.12-1.06-.39-2.02-1.25-.74-.66-1.24-1.47-1.39-1.72-.15-.25-.02-.39.11-.51.12-.12.25-.3.37-.45.12-.15.17-.25.25-.42.08-.17.04-.31-.02-.43-.06-.12-.57-1.37-.78-1.87-.21-.51-.42-.44-.57-.45h-.49c-.17 0-.43.06-.66.31-.23.25-.86.84-.86 2.05s.88 2.38 1 2.54c.12.17 1.73 2.64 4.19 3.7.59.25 1.05.4 1.41.51.59.19 1.13.16 1.56.1.48-.07 1.49-.61 1.7-1.2.21-.59.21-1.09.15-1.2-.06-.11-.23-.18-.48-.3z" />
        </svg>
      </span>
      <span className="whatsapp-float__label">Chat with us</span>
    </a>
  );
}