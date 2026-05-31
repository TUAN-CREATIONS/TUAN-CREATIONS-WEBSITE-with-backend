import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BookOpen, Globe, Mail, Menu, ShoppingBag, Tv, Users, X, Lightbulb, Handshake, Bell, BarChart3, GraduationCap, ChevronDown, Moon, Sun } from "lucide-react";
import { theme } from "../bright-gold/theme";
import { useAuth } from "../store/auth";
import BackButton from "./BackButton";

const navigation = [
  { name: "Home", href: "/", icon: Globe },
  { name: "About", href: "/about", icon: Users },
  { name: "Divisions", href: "/divisions", icon: Globe },
  { name: "Blog", href: "/blog", icon: BookOpen },
  { name: "Contact", href: "/contact", icon: Mail },
  { name: "Academy", href: "/academy", icon: BookOpen },
  { name: "Marketplace", href: "/marketplace", icon: ShoppingBag },
  { name: "Live", href: "/media", icon: Tv },
  { name: "Innovations Hub", href: "/iot", icon: Lightbulb },
  { name: "Hub", href: "/collaboration", icon: Handshake },
];

const Header = memo(() => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [aboutMenuOpen, setAboutMenuOpen] = useState(false);
  const [colorMode, setColorMode] = useState<"light" | "dark">("light");
  const location = useLocation();
  const { user } = useAuth();

  const toggleMenu = useCallback(() => setIsMenuOpen((prev) => !prev), []);
  const closeMenu = useCallback(() => setIsMenuOpen(false), []);
  const toggleColorMode = useCallback(() => {
    setColorMode((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("tuan-color-mode", next);
      document.documentElement.setAttribute("data-theme", next);
      return next;
    });
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isMenuOpen]);

  useEffect(() => {
    const storedMode = localStorage.getItem("tuan-color-mode");
    const initialMode = storedMode === "dark" ? "dark" : "light";
    setColorMode(initialMode);
    document.documentElement.setAttribute("data-theme", initialMode);
  }, []);

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <>
      {navigation.map(({ name, href, icon: Icon }) => {
        if (name === "About") {
          const aboutRef = useRef<HTMLDivElement | null>(null);

          useEffect(() => {
            function handleDocClick(e: MouseEvent) {
              if (!aboutRef.current) return;
              if (!(e.target instanceof Node)) return;
              if (!aboutRef.current.contains(e.target)) {
                setAboutMenuOpen(false);
              }
            }
            if (aboutMenuOpen) {
              document.addEventListener("mousedown", handleDocClick);
            }
            return () => document.removeEventListener("mousedown", handleDocClick);
          }, [aboutMenuOpen]);

          return (
            <div
              key={name}
              className={`relative ${aboutMenuOpen ? "menu-open" : ""}`}
              ref={aboutRef}
              onMouseEnter={() => setAboutMenuOpen(true)}
              onMouseLeave={() => setAboutMenuOpen(false)}
            >
              <button
                type="button"
                onClick={() => setAboutMenuOpen((prev) => !prev)}
                aria-expanded={aboutMenuOpen}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 ${
                  location.pathname.startsWith("/about")
                    ? "bg-yellow-500 text-black shadow-md"
                    : "text-gray-900 hover:bg-yellow-400 hover:text-black"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{name}</span>
                <ChevronDown className="h-3 w-3" />
              </button>

              {aboutMenuOpen && (
                <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-black/10 bg-white p-2 shadow-lg">
                  <Link
                    to="/about"
                    onClick={() => {
                      setAboutMenuOpen(false);
                      onClick?.();
                    }}
                    className={`block rounded-lg px-3 py-2 text-sm transition ${
                      location.pathname === "/about"
                        ? "bg-yellow-500 text-black shadow-md"
                        : "text-gray-900 hover:bg-yellow-400 hover:text-black"
                    }`}
                  >
                    About Us
                  </Link>
                  <Link
                    to="/about/management-team"
                    onClick={() => {
                      setAboutMenuOpen(false);
                      onClick?.();
                    }}
                    className={`block rounded-lg px-3 py-2 text-sm transition ${
                      location.pathname === "/about/management-team"
                        ? "bg-yellow-500 text-black shadow-md"
                        : "text-gray-900 hover:bg-yellow-400 hover:text-black"
                    }`}
                  >
                    Management Team
                  </Link>
                </div>
              )}
            </div>
          );
        }

        const isActive = location.pathname === href;
        return (
          <Link
            key={name}
            to={href}
            onClick={onClick}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 ${
              isActive ? "bg-yellow-500 text-black shadow-md" : "text-gray-900 hover:bg-yellow-400 hover:text-black"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span>{name}</span>
          </Link>
        );
      })}
      {user && (
        <>
          <Link
            to="/notifications"
            onClick={onClick}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 ${
              location.pathname === "/notifications"
                ? "bg-yellow-500 text-black shadow-md"
                : "text-gray-900 hover:bg-yellow-400 hover:text-black"
            }`}
          >
            <Bell className="h-4 w-4" />
            <span>Notifications</span>
          </Link>
          <Link
            to="/academy/mentorship"
            onClick={onClick}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 ${
              location.pathname === "/academy/mentorship"
                ? "bg-yellow-500 text-black shadow-md"
                : "text-gray-900 hover:bg-yellow-400 hover:text-black"
            }`}
          >
            <GraduationCap className="h-4 w-4" />
            <span>Mentorship</span>
          </Link>
          {(user.role === "instructor" || user.role === "admin") && (
            <Link
              to="/instructor-dashboard"
              onClick={onClick}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 ${
                location.pathname === "/instructor-dashboard"
                  ? "bg-yellow-500 text-black shadow-md"
                  : "text-gray-900 hover:bg-yellow-400 hover:text-black"
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span>Instructor</span>
            </Link>
          )}
          {user.role === "admin" && (
            <Link
              to="/admin/academy/analytics"
              onClick={onClick}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 ${
                location.pathname === "/admin/academy/analytics"
                  ? "bg-yellow-500 text-black shadow-md"
                  : "text-gray-900 hover:bg-yellow-400 hover:text-black"
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span>Analytics</span>
            </Link>
          )}
        </>
      )}
    </>
  );

  return (
    <header
      className="sticky top-0 z-50 shadow-md transition-all duration-300"
      style={{
        backgroundColor: theme.colors.primary,
        color: theme.colors.text,
        fontFamily: theme.typography.fontFamily,
      }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <BackButton fallbackTo="/" label="Back" className="shrink-0" />
            <Link to="/" className="flex items-center gap-2" onClick={closeMenu}>
                <span className="logo-container logo-container-sm shrink-0">
                <img className="logo" src="/TUAN_CREATIONS_LOGO-removebg-preview%20(3).png" alt="TUAN Creations Company Ltd Logo" />
              </span>
              <span className="text-base font-bold tracking-tight text-gray-900 sm:text-lg lg:text-xl">TUAN Creations Company Ltd</span>
            </Link>
          </div>

          <nav className="hidden flex-wrap justify-end gap-2 md:flex">
            <NavLinks />
          </nav>

          <button
            type="button"
            onClick={toggleColorMode}
            aria-label="Toggle color mode"
            className="rounded-md p-2 text-gray-900 transition-colors hover:bg-yellow-400 hover:text-black"
          >
            {colorMode === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          <button
            onClick={toggleMenu}
            aria-label="Toggle navigation menu"
            className="rounded-md p-2 transition-colors hover:bg-yellow-400 hover:text-black md:hidden"
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="animate-slideDown pb-4 md:hidden mobile-menu">
            <nav className="flex flex-col gap-2">
              <NavLinks onClick={closeMenu} />
            </nav>
          </div>
        )}
      </div>
    </header>
  );
});

Header.displayName = "Header";

export default Header;
