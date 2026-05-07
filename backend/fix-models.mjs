import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modelsPath = path.join(__dirname, 'src', 'models.js');

let content = fs.readFileSync(modelsPath, 'utf8');

// Remove the corrupted export lines (with spaces between characters)
content = content.split('\n')
  .filter(line => !line.match(/^e\s+x\s+p\s+o\s+r\s+t/))
  .filter(line => !line.match(/mongoose\.model\('Quiz'.*quizSchema\)/))
  .filter(line => !line.match(/mongoose\.model\('QuizResult'.*quizResultSchema\)/))
  .filter(line => !line.match(/mongoose\.model\('StudyGroup'.*studyGroupSchema\)/))
  .filter(line => !line.match(/mongoose\.model\('MentorshipPairing'.*mentorshipPairingSchema\)/))
  .join('\n')
  .trim();

// Add the proper exports
const newExports = `
export const Quiz = mongoose.model("Quiz", quizSchema);
export const QuizResult = mongoose.model("QuizResult", quizResultSchema);
export const StudyGroup = mongoose.model("StudyGroup", studyGroupSchema);
export const MentorshipPairing = mongoose.model("MentorshipPairing", mentorshipPairingSchema);
`;

content += newExports;

fs.writeFileSync(modelsPath, content, 'utf8');
console.log('✓ models.js exports fixed successfully');
