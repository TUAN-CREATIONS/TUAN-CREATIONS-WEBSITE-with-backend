import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { ChevronDown, Menu, X, Mail, Phone, MapPin, Moon, Sun } from "lucide-react";
import BackButton from "../components/BackButton";
import useColorMode from "../hooks/useColorMode";

const publicNav = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/divisions", label: "Divisions" },
  { to: "/blog", label: "Blog" },
  { to: "/contact", label: "Contact" },
];

export default function PublicLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [aboutMenuOpen, setAboutMenuOpen] = useState(false);
  const { mode, toggleMode } = useColorMode();

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "auto";

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [mobileMenuOpen]);

  const mobileCardClass = (active: boolean) =>
    `block rounded-xl border border-white/10 px-4 py-3 text-sm transition ${
      active ? "bg-[#f0c86a] text-[#071022]" : "bg-[#0b1830] text-[#e6eef8] hover:bg-[#112544]"
    }`;

  return (
    <div className="min-h-screen bg-[var(--surface)] text-[var(--text)]">
      <div className="hero-glow" aria-hidden />

      <header
        className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--header-bg)] backdrop-blur-md"
        style={mobileMenuOpen ? { zIndex: 10001 } : undefined}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <BackButton fallbackTo="/" label="Back" className="shrink-0" />
            <Link to="/" className="flex items-center gap-2 text-[var(--gold)]">
              <span className="logo-container logo-container-sm">
                <img className="logo" src="/TUAN_CREATIONS_LOGO-removebg-preview%20(3).png" alt="TUAN Creations Company Ltd Logo" />
              </span>
              <span className="font-display text-sm tracking-wide sm:text-base lg:text-lg">TUAN Creations Company Ltd</span>
            </Link>
          </div>

          <nav className="hidden flex-1 items-center justify-end gap-5 text-sm font-medium lg:flex">
            {publicNav.map((item) => {
              if (item.to === "/about") {
                return (
                  <div key={item.to} className="relative">
                    <button
                      type="button"
                      onClick={() => setAboutMenuOpen((prev) => !prev)}
                      className={`inline-flex items-center gap-2 border-b-2 border-transparent pb-1 transition ${
                        location.pathname.startsWith("/about")
                          ? "border-[var(--hero-accent)] text-[var(--hero-text)]"
                          : "text-[var(--hero-text-soft)] hover:text-[var(--hero-text)]"
                      }`}
                    >
                      {item.label}
                      <ChevronDown size={14} />
                    </button>
                    {aboutMenuOpen && (
                      <div className="absolute left-0 top-full mt-3 w-56 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-xl">
                        <NavLink
                          to="/about"
                          onClick={() => setAboutMenuOpen(false)}
                          className={({ isActive }) =>
                            `block rounded-xl px-3 py-2 text-sm transition ${
                              isActive
                                ? "bg-[var(--gold)] text-[var(--ink)]"
                                : "text-[var(--text-soft)] hover:bg-[var(--card)] hover:text-[var(--text)]"
                            }`
                          }
                        >
                          About Us
                        </NavLink>
                        <NavLink
                          to="/about/management-team"
                          onClick={() => setAboutMenuOpen(false)}
                          className={({ isActive }) =>
                            `block rounded-xl px-3 py-2 text-sm transition ${
                              isActive
                                ? "bg-[var(--gold)] text-[var(--ink)]"
                                : "text-[var(--text-soft)] hover:bg-[var(--card)] hover:text-[var(--text)]"
                            }`
                          }
                        >
                          Management Team
                        </NavLink>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `border-b-2 border-transparent pb-1 transition ${
                      isActive
                        ? "border-[var(--hero-accent)] text-[var(--hero-text)]"
                        : "text-[var(--hero-text-soft)] hover:text-[var(--hero-text)]"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          <Link className="btn-primary hidden text-xs sm:text-sm lg:inline-flex" to="/dashboard">
            <span className="block text-center">Explore TUAN Digital Platform</span>
          </Link>

          <button
            type="button"
            onClick={toggleMode}
            aria-label="Toggle color mode"
            className="inline-flex items-center justify-center rounded-full border border-[var(--line)] p-2 text-[var(--hero-text-soft)] transition hover:border-[var(--hero-accent)] hover:text-[var(--hero-text)]"
          >
            {mode === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button
            type="button"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-full border border-[var(--line)] p-2 text-[var(--gold-soft)] transition hover:border-[var(--gold)] hover:text-[var(--text)] lg:hidden"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="absolute left-0 right-0 top-full z-[10002] border-t border-white/10 bg-[#071022] px-4 py-3 text-[#e6eef8] shadow-2xl lg:hidden sm:px-6">
            <div className="flex justify-end pb-2">
              <button
                type="button"
                onClick={closeMobileMenu}
                aria-label="Close menu"
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-[#0b1830] p-2 text-[#f0c86a]"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="flex flex-col gap-2">
              {publicNav.map((item) =>
                item.to === "/about" ? (
                  <div key={item.to} className="rounded-2xl border border-white/10 bg-[#0b1830] p-2 shadow-lg">
                    <button
                      type="button"
                      onClick={() => setAboutMenuOpen((prev) => !prev)}
                      className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-[#e6eef8]"
                    >
                      <span>About</span>
                      <ChevronDown size={14} />
                    </button>
                    {aboutMenuOpen && (
                      <div className="mt-2 flex flex-col gap-2 p-1">
                        <NavLink key="about-us-mobile" to="/about" onClick={closeMobileMenu} className={({ isActive }) => mobileCardClass(isActive)}>
                          About Us
                        </NavLink>
                        <NavLink key="management-team-mobile" to="/about/management-team" onClick={closeMobileMenu} className={({ isActive }) => mobileCardClass(isActive)}>
                          Management Team
                        </NavLink>
                      </div>
                    )}
                  </div>
                ) : (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={closeMobileMenu}
                    className={({ isActive }) => mobileCardClass(isActive)}
                  >
                    {item.label}
                  </NavLink>
                ),
              )}
              <Link className="mt-2 block rounded-2xl bg-[#f0c86a] px-4 py-3 text-center text-sm font-semibold text-[#071022] shadow-lg" to="/dashboard" onClick={closeMobileMenu}>
                Explore TUAN Digital Platform
              </Link>
            </nav>
          </div>
        )}
      </header>

      <main className="relative z-10">
        <Outlet />
      </main>

      <footer className="sunbird-footer mt-16 border-t border-[var(--line)]">
        <div className="mx-auto max-w-7xl px-4 py-10 text-sm text-[var(--footer-text-soft)] sm:px-6 lg:px-8">
              <div className="text-center">
            <p className="font-display text-base tracking-wide text-[var(--gold)] sm:text-lg">
              TUAN Digital Platform
            </p>
            <p className="sunbird-footer__soft mt-1 text-xs sm:text-sm">
              {"[The United African Nation - \"All-in-One Digital Space\"]"}
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-stretch sm:justify-center sm:gap-0">
            <div className="flex flex-col items-center justify-center space-y-3 text-center sm:w-1/2 sm:border-r sm:border-white/80 sm:px-10 sm:max-w-md">
              <div className="flex items-center justify-center gap-2 md:justify-start">
                <Mail className="sunbird-footer__accent h-4 w-4" />
                <a href="mailto:tuancreations.africa@gmail.com" className="hover:underline">tuancreations.africa@gmail.com</a>
              </div>

              <div className="flex items-center justify-center gap-2 md:justify-start">
                {/* WhatsApp link for main contact aligned with other contacts */}
                {(() => {
                  const raw = "+256 753 414 058";
                  const digits = raw.replace(/[^0-9+]/g, "");
                  const waNumber = digits.replace(/\+/g, "");
                  const waHref = `https://wa.me/${waNumber}`;
                  return (
                    <>
                      <svg className="sunbird-footer__accent h-4 w-4 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" role="presentation" focusable="false" aria-hidden>
                        <path d="M12.04 2C6.55 2 2.09 6.46 2.09 11.95c0 1.76.46 3.47 1.33 4.98L2 22l5.23-1.37a9.89 9.89 0 0 0 4.81 1.23c5.49 0 9.95-4.46 9.95-9.95S17.53 2 12.04 2zm0 18.08c-1.48 0-2.92-.39-4.18-1.12l-.3-.18-3.1.81.83-3.02-.2-.31a8.13 8.13 0 1 1 6.95 3.82zm4.49-6.09c-.25-.12-1.49-.74-1.72-.82-.23-.09-.4-.12-.57.12-.17.25-.66.82-.81.99-.15.17-.3.19-.55.06-.25-.12-1.06-.39-2.02-1.25-.74-.66-1.24-1.47-1.39-1.72-.15-.25-.02-.39.11-.51.12-.12.25-.3.37-.45.12-.15.17-.25.25-.42.08-.17.04-.31-.02-.43-.06-.12-.57-1.37-.78-1.87-.21-.51-.42-.44-.57-.45h-.49c-.17 0-.43.06-.66.31-.23.25-.86.84-.86 2.05s.88 2.38 1 2.54c.12.17 1.73 2.64 4.19 3.7.59.25 1.05.4 1.41.51.59.19 1.13.16 1.56.1.48-.07 1.49-.61 1.7-1.2.21-.59.21-1.09.15-1.2-.06-.11-.23-.18-.48-.3z" />
                      </svg>
                      <a href={waHref} target="_blank" rel="noreferrer" aria-label={`Chat on WhatsApp ${raw}`} className="hover:underline">
                        {raw}
                      </a>
                    </>
                  );
                })()}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 md:justify-start">
                  <Phone className="sunbird-footer__accent h-4 w-4" />
                  <a href="tel:+256786691998" className="hover:underline">+256 786 691 998</a>
                </div>
                <div className="flex items-center justify-center gap-2 md:justify-start">
                  <Phone className="sunbird-footer__accent h-4 w-4" />
                  <a href="tel:+256787882124" className="hover:underline">+256 787 882 124</a>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 md:justify-start">
                <MapPin className="sunbird-footer__accent h-4 w-4" />
                <span>Kampala, Uganda</span>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center text-center sm:w-1/2 sm:px-10 sm:max-w-md">
              <p className="font-medium text-[var(--footer-text)]">© 2026 TUAN Creations Company Ltd</p>
              <p className="sunbird-footer__soft mt-1 text-xs leading-relaxed">
                Company registration number (URSB): 80034131408564.
                <br />
                P.O.Box 207659 - Kampala.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
