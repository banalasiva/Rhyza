// The daily question — a tiny, thought-provoking prompt anyone can answer in a
// tap, then see how everyone else answered. Some light, some deep; all safe and
// relatable from a 10-year-old to a grandparent. This is the daily *ritual* —
// low effort in, a little social reward out. Kept in code (no vendor, no cost);
// the picker rotates through so it runs for a couple of months without repeat.

export type DailyQuestion = { text: string; options: string[] };

export const DAILY_QUESTIONS: DailyQuestion[] = [
  { text: "In a big decision, what do you trust more?", options: ["My gut", "The facts", "Both, together"] },
  { text: "Would you tell a small white lie to protect someone's feelings?", options: ["Yes", "No", "It depends"] },
  { text: "The best way to make a hard choice is to…", options: ["Sleep on it", "Talk it out", "Just decide"] },
  { text: "When your family disagrees, who usually turns out right?", options: ["The loudest", "The quietest", "Nobody — it's a mix"] },
  { text: "What matters most in a decision that affects everyone?", options: ["That it's fair", "That it's fast", "That everyone's heard"] },
  { text: "You get unexpected money. First instinct?", options: ["Save it", "Spend it", "Share it"] },
  { text: "A choice you regret usually came from…", options: ["Deciding too fast", "Waiting too long", "Not asking others"] },
  { text: "Whose opinion do you seek first on something big?", options: ["Family", "A close friend", "Nobody, at first"] },
  { text: "Planning a trip, you'd rather…", options: ["Plan every detail", "Wing it", "A rough plan, then flow"] },
  { text: "The hardest part of any decision is…", options: ["Knowing what I want", "Letting a good option go", "Living with it after"] },
  { text: "When someone changes your mind, it's usually because they…", options: ["Had better facts", "Understood me", "Told a story"] },
  { text: "A good decision is one you can…", options: ["Defend with logic", "Explain to a child", "Sleep peacefully after"] },
  { text: "For a family purchase, who should have the biggest say?", options: ["Whoever pays", "Whoever it affects most", "Everyone, equally"] },
  { text: "You're more likely to regret…", options: ["Something you did", "Something you didn't", "Depends on the day"] },
  { text: "When you're stuck between two options, you…", options: ["Flip a coin", "List pros and cons", "Ask someone you trust"] },
  { text: "The best advice is usually…", options: ["Honest, even if it stings", "Kind and gentle", "A question, not an answer"] },
  { text: "What changes your mind fastest?", options: ["A real example", "A number", "Someone you respect"] },
  { text: "In a group, the best ideas come from…", options: ["The expert", "The newcomer", "The disagreement"] },
  { text: "You'd rather be…", options: ["Right and alone", "Wrong but together", "Neither — let's rethink"] },
  { text: "A decision feels 'done' when…", options: ["Everyone agrees", "I stop second-guessing", "We act on it"] },
  { text: "Money aside, the best decisions protect…", options: ["Time", "Relationships", "Peace of mind"] },
  { text: "When advising a friend, you tend to…", options: ["Tell them what I'd do", "Ask what they want", "Just listen"] },
  { text: "The riskier move is usually…", options: ["Changing things", "Keeping them the same", "Deciding alone"] },
  { text: "You learn the most from…", options: ["Your wins", "Your mistakes", "Other people's mistakes"] },
  { text: "A decision made together is…", options: ["Slower but stronger", "Messier but fairer", "Usually worth it"] },
  { text: "What would you rather your kids/family learn?", options: ["How to be right", "How to disagree well", "How to decide together"] },
  { text: "When you can't decide, it often means…", options: ["Both options are fine", "I'm missing information", "I already know, secretly"] },
  { text: "The best time to make a big call is…", options: ["Morning, fresh", "After sleeping on it", "Once everyone's calm"] },
  { text: "You trust a decision more when…", options: ["The reasons are written down", "It just feels right", "Others sign off on it"] },
  { text: "The point of talking it through is to…", options: ["Win the argument", "Find the best answer", "Make sure no one's left out"] },
];

function pickByDay<T>(arr: T[], now: Date): T {
  const dayNumber = Math.floor(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86400000,
  );
  const n = arr.length;
  return arr[((dayNumber % n) + n) % n];
}

export function questionOfTheDay(now = new Date()): DailyQuestion {
  return pickByDay(DAILY_QUESTIONS, now);
}

// The stable per-day key answers are recorded under (UTC).
export function dayKey(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
