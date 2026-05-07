import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modelsPath = path.join(__dirname, 'src', 'models.js');

let content = fs.readFileSync(modelsPath, 'utf8');

// Remove lines with corrupted spacing (e x p o r t pattern)
const lines = content.split('\n');
const cleaned = lines
  .filter(line => {
    // Skip lines with spaced-out export pattern
    if (line.includes('e x p o r t')) return false;
    // Skip duplicate Quiz exports with single quotes and spacing
    if (line.includes("mongoose.model('Quiz'")) return false;
    if (line.includes("mongoose.model('QuizResult'")) return false;
    if (line.includes("mongoose.model('StudyGroup'")) return false;
    if (line.includes("mongoose.model('MentorshipPairing'")) return false;
    return true;
  })
  .join('\n')
  .trim();

// Add the proper exports at the end
const newExports = `
export const Quiz = mongoose.model("Quiz", quizSchema);
export const QuizResult = mongoose.model("QuizResult", quizResultSchema);
export const StudyGroup = mongoose.model("StudyGroup", studyGroupSchema);
export const MentorshipPairing = mongoose.model("MentorshipPairing", mentorshipPairingSchema);
`;

fs.writeFileSync(modelsPath, cleaned + newExports, 'utf8');
console.log('✓ models.js cleaned and exports added');
