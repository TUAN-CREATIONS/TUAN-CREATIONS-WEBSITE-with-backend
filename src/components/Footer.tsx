import { memo } from "react";
import { Link } from "react-router-dom";
import { Globe, Mail, MapPin, Phone } from "lucide-react";
import { useSiteConfig } from "../hooks/useSiteConfig";

const Footer = memo(() => {
  const [config] = useSiteConfig();

  return (
    <footer className="sunbird-footer text-[var(--footer-text)]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
            <div className="grid grid-cols-1 gap-8 text-center md:grid-cols-4 md:text-left">
          <div className="col-span-1 flex flex-col items-center md:col-span-2 md:items-start">
            <span className="logo-container mb-4 h-16 w-[min(100%,12rem)] md:h-20 md:w-[16rem]">
              <img className="logo" src="/TUAN_CREATIONS_LOGO-removebg-preview%20(3).png" alt={`${config["site.name"] || "TUAN"} Logo`} />
            </span>
            <p className="sunbird-footer__soft mb-3 max-w-md text-sm md:text-base">
              {config["site.description"] || "Building the United African Nation in Technology through practical learning, trusted services, and innovation."}
            </p>
            <p className="sunbird-footer__accent font-semibold italic">{config["site.tagline"] || "Africa Inspired!"}</p>
          </div>

          <div>
            <h4 className="mb-4 text-base font-semibold text-[var(--footer-text)] md:text-lg">Quick Links</h4>
            <ul className="sunbird-footer__soft space-y-2 text-sm md:text-base">
              <li><Link to="/" className="transition-colors hover:text-white">Home</Link></li>
              <li><Link to="/about" className="transition-colors hover:text-white">About</Link></li>
              <li><Link to="/divisions" className="transition-colors hover:text-white">Divisions</Link></li>
              <li><Link to="/blog" className="transition-colors hover:text-white">Blog</Link></li>
              <li><Link to="/contact" className="transition-colors hover:text-white">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-base font-semibold text-[var(--footer-text)] md:text-lg">Contact</h4>
            <div className="sunbird-footer__soft space-y-3 text-sm md:text-base">
              {config["contact.email"] && (
                <div className="flex items-center justify-center gap-2 md:justify-start">
                  <Mail className="sunbird-footer__accent h-4 w-4" />
                  <span>{config["contact.email"]}</span>
                </div>
              )}
              {config["contact.phone"] && (
                <div className="space-y-2">
                  {String(config["contact.phone"]).split(/[\\/;,]+/).map((part, idx) => {
                    const raw = part.trim();
                    if (!raw) return null;
                    const tel = raw.replace(/[^0-9+]/g, "");
                    return (
                      <div key={idx} className="flex items-center justify-center gap-2 md:justify-start">
                        <Phone className="sunbird-footer__accent h-4 w-4" />
                        <a href={`tel:${tel}`} className="hover:underline">{raw}</a>
                      </div>
                    );
                  })}

                  {config["social.whatsapp"] && (
                    <div className="flex items-center justify-center gap-2 md:justify-start">
                        <>
                          <svg className="sunbird-footer__accent h-4 w-4 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" role="presentation" focusable="false" aria-hidden>
                            <path d="M12.04 2C6.55 2 2.09 6.46 2.09 11.95c0 1.76.46 3.47 1.33 4.98L2 22l5.23-1.37a9.89 9.89 0 0 0 4.81 1.23c5.49 0 9.95-4.46 9.95-9.95S17.53 2 12.04 2zm0 18.08c-1.48 0-2.92-.39-4.18-1.12l-.3-.18-3.1.81.83-3.02-.2-.31a8.13 8.13 0 1 1 6.95 3.82zm4.49-6.09c-.25-.12-1.49-.74-1.72-.82-.23-.09-.4-.12-.57.12-.17.25-.66.82-.81.99-.15.17-.3.19-.55.06-.25-.12-1.06-.39-2.02-1.25-.74-.66-1.24-1.47-1.39-1.72-.15-.25-.02-.39.11-.51.12-.12.25-.3.37-.45.12-.15.17-.25.25-.42.08-.17.04-.31-.02-.43-.06-.12-.57-1.37-.78-1.87-.21-.51-.42-.44-.57-.45h-.49c-.17 0-.43.06-.66.31-.23.25-.86.84-.86 2.05s.88 2.38 1 2.54c.12.17 1.73 2.64 4.19 3.7.59.25 1.05.4 1.41.51.59.19 1.13.16 1.56.1.48-.07 1.49-.61 1.7-1.2.21-.59.21-1.09.15-1.2-.06-.11-.23-.18-.48-.3z" />
                          </svg>
                          <a href={`https://wa.me/${String(config["social.whatsapp"]).replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" aria-label={`Chat on WhatsApp ${config["social.whatsapp"]}`} className="hover:underline">
                            {config["social.whatsapp"]}
                          </a>
                        </>
                    </div>
                  )}
                </div>
              )}
              {config["contact.location"] && (
                <div className="flex items-center justify-center gap-2 md:justify-start">
                  <MapPin className="sunbird-footer__accent h-4 w-4" />
                  <span>{config["contact.location"]}</span>
                </div>
              )}
              {config["contact.region"] && (
                <div className="flex items-center justify-center gap-2 md:justify-start">
                  <Globe className="sunbird-footer__accent h-4 w-4" />
                  <span>{config["contact.region"]}</span>
                </div>
              )}
            </div>
          </div>
        </div>

          <div className="mt-8 border-t border-gray-300/30 pt-6 text-center">
          <p className="sunbird-footer__soft text-sm font-medium md:text-base">
            Copyright {config["copyright.year"] || "2026"} {config["site.name"] || "TUAN Creations Company Ltd"}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = "Footer";

export default Footer;
