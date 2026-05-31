import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadManagementTeam } from "../../modules/admin/managementTeamData";
import { getCourses, getPublicMedia, type Course, type PublicMediaItem } from "../../services/api";

const discovery = [
  { title: "Explore Our Vision", to: "/about", description: "Understand what TUAN is building and how it creates value for communities and businesses." },
  { title: "Explore Divisions", to: "/divisions", description: "See the full range of services from software and telecom to TUAN Live, TUAN Academy, and TUAN Innovations Hub." },
  { title: "Academy", to: "/academy", description: "Join live classes, learn from trusted instructors, and replay lessons anytime." },
  { title: "Live Media", to: "/media", description: "Follow live programs, partner channels, and recorded shows in one place." },
  { title: "Marketplace", to: "/marketplace", description: "Choose verified ICT companies and freelancers for your next project." },
  { title: "Join as Student, Client, Partner, or Investor", to: "/auth", description: "Create your account and access services tailored to your role." },
];

export default function HomePage() {
  const [mediaItems, setMediaItems] = useState<PublicMediaItem[]>([]);
  const [courseItems, setCourseItems] = useState<Course[]>([]);
  const managementTeam = loadManagementTeam();

  useEffect(() => {
    let mounted = true;

    Promise.all([getPublicMedia(), getCourses()]).then(([publicMedia, courses]) => {
      if (!mounted) return;
      setMediaItems(publicMedia);
      setCourseItems(courses);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const motionItems = [
    ...managementTeam.slice(0, 4).map((member) => ({
      id: member.id,
      kind: "profile" as const,
      title: member.name,
      subtitle: member.position,
      description: member.description,
      source: "/TUAN_CREATIONS_LOGO-removebg-preview%20(3).png",
      badge: member.occupation,
    })),
    ...courseItems.slice(0, 2).map((course) => ({
      id: `course-${course.id}`,
      kind: "course" as const,
      title: course.title,
      subtitle: `${course.level} • ${course.duration}`,
      description: course.content?.description ?? `Learn with ${course.instructor} through TUAN Academy.`,
      source: course.content?.thumbnail ?? "/TUAN_CREATIONS_LOGO-removebg-preview%20(3).png",
      badge: `${course.enrolled.toLocaleString()} enrolled`,
    })),
    ...mediaItems,
    {
      id: "feature-services",
      kind: "feature" as const,
      title: "Software & ICT Services",
      subtitle: "Trusted delivery stack",
      description: "Practical digital services for businesses, institutions, and organizations ready to scale.",
      source: "/TUAN_CREATIONS_LOGO-removebg-preview%20(3).png",
      badge: "Core element",
    },
    {
      id: "feature-academy",
      kind: "feature" as const,
      title: "Academy",
      subtitle: "Live learning and replays",
      description: "Trusted learning paths for students and professionals across the platform.",
      source: "/TUAN_CREATIONS_LOGO-removebg-preview%20(3).png",
      badge: "Feature",
    },
    {
      id: "feature-marketplace",
      kind: "feature" as const,
      title: "Marketplace",
      subtitle: "Verified providers",
      description: "A verified space where clients can find reliable freelancers, firms, and digital solutions.",
      source: "/TUAN_CREATIONS_LOGO-removebg-preview%20(3).png",
      badge: "Feature",
    },
    {
      id: "feature-media",
      kind: "feature" as const,
      title: "Live Media",
      subtitle: "Broadcast and replay",
      description: "Media that educates, promotes partner work, and keeps communities informed.",
      source: "/TUAN_CREATIONS_LOGO-removebg-preview%20(3).png",
      badge: "Feature",
    },
    {
      id: "feature-innovation",
      kind: "feature" as const,
      title: "Innovations Hub",
      subtitle: "IoT, robotics, and chips",
      description: "Hands-on innovation tracks for future-ready builders and technologists.",
      source: "/TUAN_CREATIONS_LOGO-removebg-preview%20(3).png",
      badge: "Feature",
    },
  ];
  const showcaseItems = motionItems.slice(0, 8);
  const loopItems = showcaseItems.length > 0 ? [...showcaseItems, ...showcaseItems] : [];
  const reverseItems = showcaseItems.length > 0 ? [...showcaseItems].reverse().concat([...showcaseItems].reverse()) : [];

  const MotionCard = ({ item }: { item: (PublicMediaItem & { kind: "image" | "video" }) | { id: string; kind: "profile" | "feature" | "course"; title: string; subtitle: string; description: string; source: string; badge: string } }) => {
    const isMedia = item.kind === "image" || item.kind === "video";
    const isBrandCard = !isMedia;
    const initials = item.title
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
    return (
      <article className={`sunbird-motion__card ${isMedia ? (item.kind === "video" ? "tone-b" : "tone-a") : "tone-c"}`}>
        <div className="relative">
          {isMedia ? (
            <img
              src={item.preview || item.source || "/TUAN_CREATIONS_LOGO-removebg-preview%20(3).png"}
              alt=""
              className="sunbird-motion__media"
              onError={(event) => {
                if (event.currentTarget.src.endsWith("/TUAN_CREATIONS_LOGO-removebg-preview%20(3).png")) return;
                event.currentTarget.src = "/TUAN_CREATIONS_LOGO-removebg-preview%20(3).png";
              }}
            />
          ) : (
            <div className={`sunbird-motion__brand-art sunbird-motion__brand-art--${item.kind}`} aria-hidden>
              <span className="sunbird-motion__brand-mark">{initials}</span>
              <div className="sunbird-motion__brand-signal" />
            </div>
          )}
          <div className={`sunbird-motion__scrim ${isBrandCard ? "sunbird-motion__scrim--brand" : ""}`} />
          {item.kind === "video" && (
            <span className="sunbird-motion__kind-badge">
              Video
            </span>
          )}
          {item.kind === "course" && (
            <span className="sunbird-motion__kind-badge sunbird-motion__kind-badge--brand">
              Course
            </span>
          )}
          {item.kind !== "image" && item.kind !== "video" && item.kind !== "course" && (
            <span className="sunbird-motion__kind-badge sunbird-motion__kind-badge--brand">
              TUAN
            </span>
          )}
        </div>
        <div className={`sunbird-motion__meta sunbird-motion__meta--overlay ${isBrandCard ? "sunbird-motion__meta--brand" : ""}`}>
          <p className="sunbird-motion__name">{item.title}</p>
          <p className="sunbird-motion__role">{item.subtitle}</p>
          {"description" in item && <p className="sunbird-motion__description">{item.description}</p>}
          {"badge" in item && <p className="sunbird-motion__pill">{item.badge}</p>}
        </div>
      </article>
    );
  };

  return (
    <div>
      <section className="sunbird-hero">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:px-8">
          <div>
            <p className="eyebrow">TUAN Digital Platform</p>
            <h1 className="mt-5 max-w-3xl font-display text-3xl leading-tight sm:text-4xl lg:text-5xl">
              Trusted all-in-one digital platform for ICT skills, services, and innovation.
            </h1>
            <p className="mt-6 max-w-2xl text-base sm:text-lg">
              TUAN Digital is a product of TUAN Creations Company Ltd, built to help clients, students, investors, and partners access trusted ICT services, learning, visibility, and innovation in one platform.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="btn-primary" to="/auth">Create Your Account</Link>
              <Link className="btn-ghost" to="/blog">Read Ecosystem Stories</Link>
            </div>
          </div>
          <div className="sunbird-motion" aria-hidden>
            <div className="sunbird-motion__halo" />
            <div className="sunbird-motion__track sunbird-motion__track--forward">
              {loopItems.map((item, index) => (
                <MotionCard key={`${item.id}-${index}`} item={item} />
              ))}
            </div>
            <div className="sunbird-motion__track sunbird-motion__track--reverse">
              {reverseItems.map((item, index) => (
                <MotionCard key={`${item.id}-reverse-${index}`} item={item} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 pt-12 sm:px-6 lg:px-8">
        <div className="sunbird-discovery">
          <div className="sunbird-discovery__glow sunbird-discovery__glow--a" aria-hidden />
          <div className="sunbird-discovery__glow sunbird-discovery__glow--b" aria-hidden />
          <div className="sunbird-discovery__grid">
            {discovery.map((item) => (
              <Link key={item.title} to={item.to} className="card card-hover sunbird-discovery__card">
                <h3 className="font-display text-xl">{item.title}</h3>
                <p className="mt-2 text-sm text-[var(--text-soft)]">{item.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8 sunbird-core">
        <div className="card">
          <p className="eyebrow">Core Components</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <h3 className="font-display text-xl">Software & ICT Services</h3>
              <p className="mt-2 text-sm text-[var(--text-soft)]">Practical digital services for businesses, institutions, and organizations ready to scale.</p>
            </div>
            <div>
              <h3 className="font-display text-xl">Academy</h3>
              <p className="mt-2 text-sm text-[var(--text-soft)]">Trusted learning paths for students and professionals, with live sessions and replays.</p>
            </div>
            <div>
              <h3 className="font-display text-xl">Marketplace</h3>
              <p className="mt-2 text-sm text-[var(--text-soft)]">A verified space where clients can find reliable freelancers, firms, and digital solutions.</p>
            </div>
            <div>
              <h3 className="font-display text-xl">Collaborations Hub</h3>
              <p className="mt-2 text-sm text-[var(--text-soft)]">Simple teamwork tools for project updates, communication, and shared delivery.</p>
            </div>
            <div>
              <h3 className="font-display text-xl">Live Media</h3>
              <p className="mt-2 text-sm text-[var(--text-soft)]">Media that educates, promotes partner work, and keeps communities informed.</p>
            </div>
            <div>
              <h3 className="font-display text-xl">Innovations Hub</h3>
              <p className="mt-2 text-sm text-[var(--text-soft)]">Hands-on innovation tracks in IoT, robotics, and chip design for future-ready builders.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
