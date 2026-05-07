export const dashboardMetrics = [
  { label: "Active Learners", value: "12,480", trend: "+18% this month", order: 1 },
  { label: "Marketplace Orders", value: "3,920", trend: "+11% this month", order: 2 },
  { label: "Live Media Reach", value: "84K", trend: "+22% this month", order: 3 },
  { label: "Innovation Programs", value: "46", trend: "+9% this month", order: 4 },
];

export const courses = [
  {
    id: 1,
    title: "AI Product Design for African Markets",
    instructor: "Eng. Godwin Ofwono",
    level: "Advanced",
    duration: "10 weeks",
    enrolled: 1280,
    content: {
      description: "Learn to design AI-powered products tailored for African market contexts, including low-bandwidth environments and diverse user needs.",
      syllabus: "Week 1-2: AI Fundamentals for Product Teams\nWeek 3-4: Market Research & User Research in Africa\nWeek 5-6: Prototyping AI Features\nWeek 7-8: Localization & Multilingual Support\nWeek 9-10: Launch Strategy & Scaling",
      prerequisites: ["Basic understanding of AI concepts", "Product design fundamentals"],
      learningObjectives: ["Design culturally-adapted AI products", "Understand African market dynamics", "Build inclusive AI systems", "Navigate ethical considerations"],
      thumbnail: "/courses/ai-design.jpg",
    },
  },
  {
    id: 2,
    title: "Cloud Security Essentials",
    instructor: "Eng. Behangana Keneth",
    level: "Intermediate",
    duration: "8 weeks",
    enrolled: 990,
    content: {
      description: "Master cloud security best practices, identity management, and compliance frameworks for AWS, GCP, and Azure environments.",
      syllabus: "Week 1: Cloud Security Fundamentals\nWeek 2-3: Identity & Access Management\nWeek 4: Network Security & Encryption\nWeek 5-6: Compliance & Governance\nWeek 7-8: Incident Response & Monitoring",
      prerequisites: ["Basic cloud computing knowledge", "Networking fundamentals"],
      learningObjectives: ["Implement secure cloud architectures", "Manage identity & access", "Handle compliance requirements", "Monitor and respond to incidents"],
      thumbnail: "/courses/cloud-security.jpg",
    },
  },
  {
    id: 3,
    title: "IoT Build Lab: Smart Farming Kits",
    instructor: "Eng. Butera Marcel",
    level: "Beginner",
    duration: "6 weeks",
    enrolled: 760,
    content: {
      description: "Build and deploy IoT solutions for smart farming, including soil sensors, weather monitoring, and automated irrigation systems.",
      syllabus: "Week 1-2: IoT & Hardware Basics\nWeek 3: Sensor Integration & Data Collection\nWeek 4: Cloud Connectivity & APIs\nWeek 5: Dashboard Development\nWeek 6: Deployment & Maintenance",
      prerequisites: ["Basic electronics", "Introduction to programming"],
      learningObjectives: ["Build IoT sensor systems", "Integrate hardware with cloud", "Develop monitoring dashboards", "Deploy production solutions"],
      thumbnail: "/courses/iot-farming.jpg",
    },
  },
];

export const listings = [
  {
    id: 1,
    name: "Custom ERP Build for SMEs",
    type: "Service",
    provider: "TUAN Software Lab",
    providerId: null,
    shortDesc: "Custom ERP tailored for small and medium enterprises",
    description: "Full-stack ERP built for SMEs with finance, inventory, and HR modules.",
    images: ["/images/erp.jpg"],
    currency: "USD",
    price: "3500",
    verified: true,
    status: "published",
    tags: ["erp", "software", "sme"],
    categories: ["software"],
  },
  {
    id: 2,
    name: "Rural Network Starter Kit",
    type: "Product",
    provider: "TUAN Telecom Division",
    providerId: null,
    shortDesc: "Turnkey rural connectivity kit",
    description: "Includes outdoor wireless routers, solar power, and installation guide.",
    images: ["/images/network-kit.jpg"],
    currency: "USD",
    price: "480",
    verified: true,
    status: "published",
    tags: ["hardware", "connectivity"],
    categories: ["hardware"],
  },
  {
    id: 3,
    name: "Media Production Sprint",
    type: "Service",
    provider: "TUAN TV Studio",
    providerId: null,
    shortDesc: "Short-form media production service",
    description: "Recording, editing, and delivery for promotional media campaigns.",
    images: ["/images/media-sprint.jpg"],
    currency: "USD",
    price: "1200",
    verified: false,
    status: "published",
    tags: ["media", "production"],
    categories: ["services"],
  },
];

export const mediaChannels = [
  {
    id: 1,
    name: "TUAN Prime",
    audience: "42K followers",
    status: "Live now",
    recordingUrl: "/media?channel=1",
    followers: 42000,
    featuredBroadcast: "Africa Tech Frontlines",
    recordingCount: 12,
  },
  {
    id: 2,
    name: "Innovation Pulse",
    audience: "18K followers",
    status: "New episode",
    recordingUrl: "/media?channel=2",
    followers: 18000,
    featuredBroadcast: "Builders of Africa",
    recordingCount: 9,
  },
  {
    id: 3,
    name: "Builders of Africa",
    audience: "24K followers",
    status: "Recording archive",
    recordingUrl: "/media?channel=3",
    followers: 24000,
    featuredBroadcast: "Community Innovation Showcase",
    recordingCount: 15,
  },
];

export const collaborationProjects = [
  {
    id: 1,
    name: "Cross-border Payments UX",
    team: 7,
    status: "In Progress",
    owner: "Partner Delivery Team",
    tasks: 18,
    channel: "Project Chat",
  },
  {
    id: 2,
    name: "Telecom Rollout Dashboard",
    team: 5,
    status: "Planning",
    owner: "TUAN Telecom Division",
    tasks: 11,
    channel: "Delivery Room",
  },
  {
    id: 3,
    name: "Agritech IoT Pilot",
    team: 11,
    status: "Delivery",
    owner: "TUAN Innovations",
    tasks: 24,
    channel: "Shared Workspace",
  },
];

export const innovationPrograms = [
  {
    id: 1,
    title: "Smart Farming Kit Program",
    mode: "Hands-on",
    seats: 120,
    enrolled: 84,
    summary: "Build low-cost soil, weather, and irrigation kits for schools and local farmers.",
  },
  {
    id: 2,
    title: "City Sensors Innovation Track",
    mode: "Hybrid",
    seats: 80,
    enrolled: 51,
    summary: "Prototype traffic, air-quality, and safety sensors that support local planning.",
  },
  {
    id: 3,
    title: "Youth Robotics Sprint",
    mode: "On-site",
    seats: 60,
    enrolled: 42,
    summary: "Launch guided robotics builds with mentors, challenges, and demo day showcases.",
  },
  {
    id: 4,
    title: "Semiconductor Design Pathway",
    mode: "Cohort",
    seats: 40,
    enrolled: 24,
    summary: "Train teams in chip architecture, FPGA prototyping, and fabrication partner readiness.",
  },
];

export const sessionSeeds = courses.map((course) => ({
  courseId: course.id,
  title: course.title,
  instructor: course.instructor,
  topic: course.id === 1 ? "Neural Networks and Deep Learning" : course.id === 2 ? "Identity, secrets, and cloud controls" : "Sensors, automation, and field deployment",
  startTime: new Date(Date.now() + course.id * 15 * 60 * 1000).toISOString(),
  durationMinutes: course.id === 1 ? 120 : course.id === 2 ? 90 : 75,
  status: "scheduled",
  recordingUrl: null,
  resources: [
    { title: "Lecture Slides", url: "/resources/slides.pdf" },
    { title: "Reference Paper", url: "/resources/paper.pdf" },
  ],
  previousSessions: [
    { title: "Intro to AI", recordingUrl: "/recordings/session1.mp4" },
    { title: "Machine Learning Basics", recordingUrl: "/recordings/session2.mp4" },
  ],
  participants: [
    { id: "u-1", name: "Eng. Godwin", role: "instructor", isOnline: true, isSpeaking: true },
    { id: "u-2", name: "Eng. Cissyln", role: "co-instructor", isOnline: true },
    { id: "u-3", name: "Sarah Nakato", role: "student", isOnline: true },
  ],
  chatMessages: [
    { id: 1, senderName: "Eng. Godwin", text: "Welcome everyone!", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), isInstructor: true },
  ],
}));

export const recordingSeeds = [
  {
    courseId: 1,
    courseTitle: "AI Product Design for African Markets",
    sessionTopic: "Intro to AI Product Design",
    instructor: "Eng. Godwin Ofwono",
    recordingUrl: "/recordings/ai-course-session-1.mp4",
    duration: 3600,
    recordedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    videoProvider: "internal",
    thumbnailUrl: "/recordings/ai-course-1.jpg",
  },
  {
    courseId: 1,
    courseTitle: "AI Product Design for African Markets",
    sessionTopic: "Market Research Strategies",
    instructor: "Eng. Godwin Ofwono",
    recordingUrl: "/recordings/ai-course-session-2.mp4",
    duration: 2700,
    recordedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    videoProvider: "internal",
    thumbnailUrl: "/recordings/ai-course-2.jpg",
  },
  {
    courseId: 2,
    courseTitle: "Cloud Security Essentials",
    sessionTopic: "IAM Foundations",
    instructor: "Eng. Behangana Keneth",
    recordingUrl: "/recordings/cloud-security-session-1.mp4",
    duration: 2400,
    recordedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    videoProvider: "internal",
    thumbnailUrl: "/recordings/cloud-security-1.jpg",
  },
  {
    courseId: 3,
    courseTitle: "IoT Build Lab: Smart Farming Kits",
    sessionTopic: "Sensor Integration Basics",
    instructor: "Eng. Butera Marcel",
    recordingUrl: "/recordings/iot-session-1.mp4",
    duration: 1800,
    recordedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    videoProvider: "internal",
    thumbnailUrl: "/recordings/iot-1.jpg",
  },
];

export const instructorSeeds = [
  {
    name: "Eng. Godwin Ofwono",
    email: "godwin.ofwono@tuancreations.com",
    role: "instructor",
    isInstructor: true,
    bio: "AI Product Designer with 8+ years of experience in African tech ecosystems",
    specialization: "AI/ML, Product Design, User Research",
  },
  {
    name: "Eng. Behangana Keneth",
    email: "behangana.keneth@tuancreations.com",
    role: "instructor",
    isInstructor: true,
    bio: "Cloud Security Architect specializing in compliance and enterprise security",
    specialization: "Cloud Security, IAM, Compliance",
  },
  {
    name: "Eng. Butera Marcel",
    email: "butera.marcel@tuancreations.com",
    role: "instructor",
    isInstructor: true,
    bio: "IoT Engineer passionate about smart farming and sustainable technology",
    specialization: "IoT, Hardware, Smart Systems",
  },
];

export const certificateSeeds = [];

export const sessionSeeds_tier2 = [
  {
    courseId: 1,
    title: "AI Product Design Session 1",
    topic: "Introduction to AI Product Design",
    startedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    endedAt: new Date(Date.now() - 47 * 60 * 60 * 1000),
    recordingUrl: "/recordings/ai-session-1.mp4",
    totalAttendees: 45,
  },
  {
    courseId: 1,
    title: "AI Product Design Session 2",
    topic: "Market Research for AI Products",
    startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    endedAt: new Date(Date.now() - 23 * 60 * 60 * 1000),
    recordingUrl: "/recordings/ai-session-2.mp4",
    totalAttendees: 52,
  },
  {
    courseId: 2,
    title: "Cloud Security Session 1",
    topic: "Identity and Access Management",
    startedAt: new Date(Date.now() - 72 * 60 * 60 * 1000),
    endedAt: new Date(Date.now() - 71 * 60 * 60 * 1000),
    recordingUrl: "/recordings/cloud-session-1.mp4",
    totalAttendees: 38,
  },
  {
    courseId: 3,
    title: "IoT Build Lab Session 1",
    topic: "Sensor Integration and Setup",
    startedAt: new Date(Date.now() - 96 * 60 * 60 * 1000),
    endedAt: new Date(Date.now() - 95 * 60 * 60 * 1000),
    recordingUrl: "/recordings/iot-session-1.mp4",
    totalAttendees: 28,
  },
];

export const notificationSeeds = [
  {
    type: "enrollment",
    title: "Welcome to AI Product Design!",
    message: "You have successfully enrolled in AI Product Design for African Markets",
    courseId: 1,
  },
  {
    type: "session_reminder",
    title: "Upcoming Session: Market Research Strategies",
    message: "Your class starts in 2 hours. Topic: Market Research for AI Products",
    courseId: 1,
  },
  {
    type: "recording_ready",
    title: "Recording Available",
    message: "The recording for Introduction to AI Product Design is now available for replay",
    courseId: 1,
  },
  {
    type: "completion",
    title: "Congratulations!",
    message: "You have completed AI Product Design for African Markets. Your certificate is ready!",
    courseId: 1,
  },
  {
    type: "announcement",
    title: "New Course Available",
    message: "Advanced Machine Learning with TensorFlow is now available for enrollment",
    courseId: null,
  },
];

export const forumThreadSeeds = [
  {
    courseId: 1,
    title: "How to approach market research in low-resource areas?",
    content: "I'm struggling to understand the methodologies for conducting effective market research in regions with limited connectivity. Can anyone share their experience?",
    views: 24,
    replies: 3,
    isPinned: false,
  },
  {
    courseId: 1,
    title: "Best practices for localization",
    content: "What are the key considerations when localizing AI products for different African markets? Language, cultural context, or something else?",
    views: 45,
    replies: 8,
    isPinned: true,
  },
  {
    courseId: 2,
    title: "AWS IAM Role vs Policy - What's the difference?",
    content: "I'm confused about when to use roles versus policies. Can someone clarify with an example?",
    views: 32,
    replies: 5,
    isPinned: false,
  },
  {
    courseId: 2,
    title: "Multi-account security strategy",
    content: "For large organizations, how do you manage security across multiple AWS accounts?",
    views: 18,
    replies: 2,
    isPinned: false,
  },
  {
    courseId: 3,
    title: "Sensor accuracy and reliability",
    content: "Which soil sensors are most reliable for long-term outdoor deployments?",
    views: 56,
    replies: 12,
    isPinned: true,
  },
];

export const quizSeeds = [
  {
    courseId: 1,
    title: "AI Fundamentals Quiz",
    description: "Short assessment covering Weeks 1-2",
    questions: [
      { question: "What does 'ML' stand for?", options: ["Machine Learning", "Micro Logic", "Meta Learning", "Model Language"], correctAnswer: 0, explanation: "ML = Machine Learning." },
      { question: "Which metric is commonly used for classification?", options: ["MSE", "Accuracy", "RMSE", "PSNR"], correctAnswer: 1, explanation: "Accuracy is common for classification." },
    ],
    passingScore: 70,
    timeLimit: 15,
    attempts: 3,
    isPublished: true,
  },
  {
    courseId: 2,
    title: "Cloud Security Basics Quiz",
    description: "Covers IAM and basic controls",
    questions: [
      { question: "What does IAM stand for?", options: ["Identity and Access Management", "Internet Access Mode", "Identity Access Matrix", "Integrated Access Management"], correctAnswer: 0, explanation: "IAM = Identity and Access Management." },
    ],
    passingScore: 70,
    timeLimit: 10,
    attempts: 2,
    isPublished: true,
  },
];

export const quizResultSeeds = [
  // These will be mapped to real user IDs during seeding
  { quizIndex: 0, userEmail: null, answers: [{ questionId: 0, selectedAnswer: 0, isCorrect: true }, { questionId: 1, selectedAnswer: 1, isCorrect: true }], score: 2, percentageScore: 100, passed: true, attemptNumber: 1, timeSpent: 120 },
];

export const studyGroupSeeds = [
  {
    courseId: 1,
    name: "AI Design Study Circle",
    description: "Weekly group to discuss AI product design case studies",
    topic: "Localization & UX",
    maxMembers: 12,
    isActive: true,
  },
  {
    courseId: 3,
    name: "IoT Builders Guild",
    description: "Hands-on prototyping group for smart farming kits",
    topic: "Hardware & Sensors",
    maxMembers: 8,
    isActive: true,
  },
];

export const mentorshipPairingSeeds = [
  // mentorEmail/menteeEmail will be resolved to IDs during seeding
  { courseId: 1, mentorEmail: "godwin.ofwono@tuancreations.com", menteeEmail: null, goals: "Product research & prototyping", status: "pending" },
];