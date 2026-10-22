import { 
  evaluateDictation, 
  tokenize, 
  lcsMatch, 
  calculateToeicListeningScore, 
  calculateIeltsBand,
  parseJson3
} from '../src/index';

function runTests() {
  console.log('--- Running Polyglot Shared Unit Tests ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`✓ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${msg}`);
      failed++;
    }
  }

  // 1. Tokenize & Normalization
  const tokens = tokenize("We're no strangers to love... (official video) [1080p]");
  assert(tokens.length === 5, 'tokenize strips brackets and parentheses');
  assert(tokens[0].n === "we're" && tokens[0].raw === "We're", 'normWord preserves apostrophe');

  // 2. LCS Match
  const { ma, mb } = lcsMatch(['never', 'gonna', 'give', 'you', 'up'], ['never', 'give', 'you', 'up']);
  assert(ma.size === 4 && mb.size === 4, 'lcsMatch correctly matches sub-sequence');

  // 3. Dictation Evaluation
  const target = "Never gonna give you up";
  const userPerfect = "never gonna give you up";
  const resPerfect = evaluateDictation(target, userPerfect);
  assert(resPerfect.accuracy === 100 && resPerfect.isPerfect, 'evaluateDictation perfect accuracy 100%');

  const userTypo = "never give you up"; // missing 'gonna'
  const resTypo = evaluateDictation(target, userTypo);
  assert(resTypo.accuracy === 80 && !resTypo.isPerfect, 'evaluateDictation 4/5 words = 80%');
  assert(resTypo.missingTokens.includes('gonna'), 'identifies missing tokens');

  // 4. TOEIC / IELTS Scoring
  const toeicScore = calculateToeicListeningScore(100, 100);
  assert(toeicScore === 495, 'TOEIC perfect score is 495');

  const ieltsScore = calculateIeltsBand(39, 40);
  assert(ieltsScore === 9.0, 'IELTS 39/40 is Band 9.0');

  // 5. JSON3 Caption Parsing
  const sampleJson3 = {
    events: [
      { tStartMs: 1000, dDurationMs: 2000, segs: [{ utf8: 'Hello world' }] },
      { tStartMs: 3500, dDurationMs: 1500, segs: [{ utf8: 'This is a test' }] }
    ]
  };
  const parsedSegments = parseJson3(sampleJson3, false);
  assert(parsedSegments.length === 2, 'parseJson3 correctly parses events into segments');
  assert(parsedSegments[0].start === 1.0 && parsedSegments[0].end === 3.0, 'calculates timestamps in seconds');

  console.log(`\nTest Summary: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runTests();
