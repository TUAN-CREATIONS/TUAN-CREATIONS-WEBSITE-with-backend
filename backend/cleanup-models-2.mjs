import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modelsPath = path.join(__dirname, 'src', 'models.js');
let raw = fs.readFileSync(modelsPath, 'utf8');
// Remove NULL and other non-printable control chars except newline/tab/carriage
raw = raw.replace(/\x00/g, '');
raw = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

// Split into lines, remove any corrupt spaced 'export' fragments
let lines = raw.split(/\r?\n/);
lines = lines.filter(line => !/^(?:\s*e\s*x\s*p\s*o\s*r\s*t\b)/.test(line));
// Remove any existing Quiz/QuizResult/StudyGroup/MentorshipPairing export lines to avoid duplicates
lines = lines.filter(line => !/^\s*export\s+const\s+(Quiz|QuizResult|StudyGroup|MentorshipPairing)\b/.test(line));

// Trim trailing empty lines
while (lines.length && lines[lines.length-1].trim() === '') lines.pop();

const cleaned = lines.join('\n') + '\n\n' +
`export const Quiz = mongoose.model("Quiz", quizSchema);
export const QuizResult = mongoose.model("QuizResult", quizResultSchema);
export const StudyGroup = mongoose.model("StudyGroup", studyGroupSchema);
export const MentorshipPairing = mongoose.model("MentorshipPairing", mentorshipPairingSchema);
`;

fs.writeFileSync(modelsPath, cleaned, 'utf8');
console.log('✓ cleanup-models-2: models.js fixed');
