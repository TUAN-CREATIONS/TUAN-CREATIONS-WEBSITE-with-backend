import bcrypt from "bcryptjs";
import { config } from "./config.js";
import { Action, Channel, Certificate, Course, Enrollment, ForumReply, ForumThread, InnovationProgram, Listing, LiveSession, Metric, MentorshipPairing, Notification, Project, Quiz, QuizResult, Recording, Session, StudyGroup, User, SiteConfig } from "./models.js";
import { collaborationProjects, courses, dashboardMetrics, innovationPrograms, listings, mediaChannels, recordingSeeds, sessionSeeds, instructorSeeds, forumThreadSeeds, notificationSeeds, sessionSeeds_tier2, quizSeeds, quizResultSeeds, studyGroupSeeds, mentorshipPairingSeeds } from "./data.js";

const seedCollection = async (Model, documents, uniqueField) => {
  const count = await Model.estimatedDocumentCount();
  if (count > 0) return;

  if (uniqueField) {
    await Model.insertMany(
      documents.map((document) => ({
        ...document,
        [uniqueField]: document[uniqueField],
      }))
    );
    return;
  }

  await Model.insertMany(documents);
};

export async function seedDatabase() {
  await seedCollection(Metric, dashboardMetrics);
  await seedCollection(Course, courses, "id");
  await seedCollection(Listing, listings, "id");
  await seedCollection(Channel, mediaChannels, "id");
  await seedCollection(Project, collaborationProjects, "id");
  await seedCollection(InnovationProgram, innovationPrograms, "id");
  await seedCollection(LiveSession, sessionSeeds, "courseId");
  await seedCollection(Recording, recordingSeeds);

  // Seed instructors
  const existingInstructor = await User.findOne({ isInstructor: true }).lean();
  if (!existingInstructor && instructorSeeds.length > 0) {
    const hashedInstructors = await Promise.all(
      instructorSeeds.map(async (instructor) => ({
        ...instructor,
        passwordHash: await bcrypt.hash("InstructorPass123!", 12),
      }))
    );
    await User.insertMany(hashedInstructors);
  }

  // Seed sessions with instructor references
  const existingSessions = await Session.estimatedDocumentCount();
  if (existingSessions === 0 && sessionSeeds_tier2.length > 0) {
    const instructors = await User.find({ isInstructor: true });
    const instructorMap = {
      1: instructors.find(i => i.name === "Eng. Godwin Ofwono")?._id,
      2: instructors.find(i => i.name === "Eng. Behangana Keneth")?._id,
      3: instructors.find(i => i.name === "Eng. Butera Marcel")?._id,
    };

    const sessionsWithInstructors = sessionSeeds_tier2.map((session) => ({
      ...session,
      instructorId: instructorMap[session.courseId] || instructors[0]?._id,
    }));

    await Session.insertMany(sessionsWithInstructors);
  }

  // Seed forum threads
  const existingThreads = await ForumThread.estimatedDocumentCount();
  if (existingThreads === 0 && forumThreadSeeds.length > 0) {
    const firstInstructor = await User.findOne({ isInstructor: true });
    const threadsWithAuthor = forumThreadSeeds.map((thread) => ({
      ...thread,
      authorId: firstInstructor?._id,
      authorName: firstInstructor?.name || "Anonymous",
    }));
    await ForumThread.insertMany(threadsWithAuthor);
  }

  // Seed quizzes
  const existingQuizzes = await Quiz.estimatedDocumentCount();
  if (existingQuizzes === 0 && quizSeeds.length > 0) {
    // Attach a generated ObjectId and insert
    await Quiz.insertMany(quizSeeds.map(q => ({ ...q })));
  }

  // Seed study groups
  const existingGroups = await StudyGroup.estimatedDocumentCount();
  if (existingGroups === 0 && studyGroupSeeds.length > 0) {
    const firstInstructor = await User.findOne({ isInstructor: true });
    const groups = studyGroupSeeds.map(g => ({ ...g, createdBy: firstInstructor?._id, members: [firstInstructor?._id] }));
    await StudyGroup.insertMany(groups);
  }

  // Seed mentorship pairings
  const existingPairings = await MentorshipPairing.estimatedDocumentCount();
  if (existingPairings === 0 && mentorshipPairingSeeds.length > 0) {
    const mentor = await User.findOne({ email: mentorshipPairingSeeds[0].mentorEmail });
    const mentee = await User.findOne({ isInstructor: false, role: { $ne: 'admin' } });
    if (mentor && mentee) {
      await MentorshipPairing.create({
        courseId: mentorshipPairingSeeds[0].courseId,
        mentorId: mentor._id,
        menteeId: mentee._id,
        mentorName: mentor.name,
        menteeName: mentee.name,
        goals: mentorshipPairingSeeds[0].goals || "",
        status: mentorshipPairingSeeds[0].status || "pending",
      });
    }
  }

  // Seed quiz results (map to the first student account)
  const existingQuizResults = await QuizResult.estimatedDocumentCount();
  if (existingQuizResults === 0 && quizResultSeeds.length > 0) {
    const quizzes = await Quiz.find().lean();
    const student = await User.findOne({ isInstructor: false, role: { $ne: 'admin' } });
    if (student && quizzes.length > 0) {
      const results = quizResultSeeds.map((r) => {
        const quiz = quizzes[r.quizIndex] || quizzes[0];
        return {
          userId: student._id,
          quizId: quiz._id,
          courseId: quiz.courseId,
          answers: r.answers || [],
          score: r.score || 0,
          percentageScore: r.percentageScore || 0,
          passed: r.passed || false,
          attemptNumber: r.attemptNumber || 1,
          timeSpent: r.timeSpent || 0,
        };
      });
      await QuizResult.insertMany(results);
    }
  }

  const actionCount = await Action.estimatedDocumentCount();
  if (actionCount === 0) {
    await Action.create({
      kind: "system.bootstrap",
      payload: { message: "TUAN backend initialized" },
    });
  }

  if (config.adminEmail && config.adminPassword) {
    const passwordHash = await bcrypt.hash(config.adminPassword, 12);
    const existingAdmin = await User.findOne({ email: config.adminEmail }).select("+passwordHash");

    if (!existingAdmin) {
      await User.create({
        name: "Platform Admin",
        email: config.adminEmail,
        role: "admin",
        passwordHash,
      });
    } else {
      existingAdmin.role = "admin";
      existingAdmin.passwordHash = passwordHash;
      await existingAdmin.save();
    }
  }

  // Seed site configuration defaults
  const existingConfig = await SiteConfig.estimatedDocumentCount();
  if (existingConfig === 0) {
    const defaultConfigs = [
      {
        key: "site.name",
        value: "TUAN Creations Company Ltd",
        description: "Site/company name",
      },
      {
        key: "site.tagline",
        value: "Africa Inspired!",
        description: "Company tagline",
      },
      {
        key: "site.description",
        value: "Building the United African Nation in Technology through practical learning, trusted services, and innovation.",
        description: "Company description for footer",
      },
      {
        key: "contact.email",
        value: "tuancreations.africa@gmail.com",
        description: "Main contact email",
      },
      {
        key: "contact.phone",
        value: "+256 753 414 058",
        description: "Main contact phone",
      },
      {
        key: "contact.location",
        value: "Kampala, Uganda",
        description: "Company location",
      },
      {
        key: "contact.region",
        value: "Pan-African Operations",
        description: "Operating region",
      },
      {
        key: "social.whatsapp",
        value: "+256753414058",
        description: "WhatsApp number for contact",
      },
      {
        key: "hero.heading",
        value: "Building The United African Nation",
        description: "Homepage hero section heading",
      },
      {
        key: "hero.subheading",
        value: "TUAN Creations Company Ltd is envisioned as a Pan-African ICT innovation enterprise designed to unify and transform the continent's fragmented digital economy.",
        description: "Homepage hero section subheading",
      },
      {
        key: "copyright.year",
        value: "2026",
        description: "Copyright year",
      },
    ];
    await SiteConfig.insertMany(defaultConfigs);
  }
}