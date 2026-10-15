// scripts/seed.js — seeds initial units, parts, blocks, practice quizzes, live quiz, and flashcards.
// Does NOT create any accounts — sign up at /register instead. The first registered account
// becomes the administrator automatically.
//
// Usage:
//   npm run db:seed
//
// Re-runnable: uses upsert so it's safe to run multiple times.
import { connectDB } from "../src/config/db.js";
import {
  Unit, Part, ContentBlock, Quiz, QuizItem, QuizOption, Flashcard, Settings,
} from "../src/models/index.js";

async function main() {
  await connectDB();
  console.log("Seeding DNHS STEM Tesla Hub for Biology 2…");

  // ===== Units =====
  const units = [
    { slug: "genetics-heredity", number: "01", title: "Genetics & Heredity", description: "The foundation: genes, alleles, genotype vs. phenotype.", sortOrder: 0 },
    { slug: "mendel-laws", number: "02", title: "Mendel's Three Laws", description: "Dominance, segregation, and independent assortment.", sortOrder: 1 },
    { slug: "non-mendelian", number: "03", title: "Non-Mendelian Inheritance", description: "Incomplete dominance and codominance.", sortOrder: 2 },
    { slug: "sex-linked", number: "04", title: "Sex-Linked Inheritance", description: "X-linked disorders like hemophilia.", sortOrder: 3 },
  ];
  for (const u of units) {
    await Unit.findOneAndUpdate({ slug: u.slug }, u, { upsert: true, new: true });
  }
  console.log(`✓ ${units.length} units upserted`);

  // Seed an introductory part for each unit if it has none
  for (const u of units) {
    const unitDoc = await Unit.findOne({ slug: u.slug });
    const partCount = await Part.countDocuments({ unitId: unitDoc._id });
    if (partCount === 0) {
      const part = await Part.create({ unitId: unitDoc._id, title: "Introduction", sortOrder: 0 });
      await ContentBlock.create({ partId: part._id, kind: "paragraph", sortOrder: 0, text: "Start writing here…" });
    }
  }

  // ===== Practice Quizzes =====
  const practiceQuizzes = [
    {
      title: "Genetics Vocabulary",
      description: "Lock in the core terms: gene, allele, genotype, phenotype, dominance.",
      shuffleItems: true, shuffleOptions: true,
      items: [
        {
          type: "multiple_choice", question: "An organism with two identical alleles for a gene is called:",
          points: 1,
          options: [
            { text: "Heterozygous", isCorrect: false },
            { text: "Homozygous", isCorrect: true },
            { text: "Hemizygous", isCorrect: false },
            { text: "Polyzygous", isCorrect: false },
          ],
          explanation: "Homo- = same. Two identical alleles (AA or aa).",
        },
        {
          type: "identification", question: "A cross between an unknown genotype and a homozygous recessive is called a ___ cross.",
          correctAnswer: "test", points: 2,
        },
        {
          type: "true_false", question: "A recessive allele is always expressed when present.",
          points: 1,
          options: [
            { text: "True", isCorrect: false },
            { text: "False", isCorrect: true },
          ],
        },
      ],
    },
    {
      title: "Mendel's Three Laws",
      description: "Segregation, independent assortment, and the 9:3:3:1 ratio.",
      shuffleItems: true, shuffleOptions: true,
      items: [
        {
          type: "multiple_choice", question: "In a Tt × Tt cross, what is the expected phenotype ratio?",
          points: 1,
          options: [
            { text: "1:1", isCorrect: false },
            { text: "3:1", isCorrect: true },
            { text: "9:3:3:1", isCorrect: false },
            { text: "1:2:1", isCorrect: false },
          ],
        },
        {
          type: "identification", question: "Mendel's law stating allele pairs separate during gamete formation is the Law of ___.",
          correctAnswer: "segregation", points: 2,
        },
      ],
    },
  ];

  for (const q of practiceQuizzes) {
    const existing = await Quiz.findOne({ title: q.title, kind: "practice" });
    if (existing) continue;
    const quiz = await Quiz.create({ title: q.title, description: q.description, kind: "practice", shuffleItems: q.shuffleItems, shuffleOptions: q.shuffleOptions });
    for (const it of q.items) {
      const item = await QuizItem.create({
        quizId: quiz._id, type: it.type, question: it.question,
        correctAnswer: it.correct_answer || "", explanation: it.explanation || "", points: it.points || 1, sortOrder: 0,
      });
      if (it.options) {
        await QuizOption.insertMany(it.options.map((o, i) => ({ itemId: item._id, text: o.text, isCorrect: o.is_correct, sortOrder: i })));
      }
    }
  }
  console.log(`✓ Practice quizzes seeded`);

  // ===== Live Quiz =====
  const existingLive = await Quiz.findOne({ kind: "live" });
  if (!existingLive) {
    const liveQuiz = await Quiz.create({
      title: "Genetics & Heredity — Unit Test",
      description: "Live hosted unit test. Anti-cheat enabled. Randomized items & options.",
      kind: "live", shuffleItems: true, shuffleOptions: true, timeLimitMin: 30,
    });
    const liveItems = [
      { type: "multiple_choice", question: "Which ratio is the signature of a dihybrid cross (F2)?", points: 2,
        options: [
          { text: "3:1", isCorrect: false },
          { text: "1:2:1", isCorrect: false },
          { text: "9:3:3:1", isCorrect: true },
          { text: "1:1", isCorrect: false },
        ] },
      { type: "identification", question: "The cross used to determine an unknown genotype is called a ___ cross.", correctAnswer: "test", points: 3 },
      { type: "multiple_choice", question: "Blood type AB is an example of:", points: 2,
        options: [
          { text: "Incomplete dominance", isCorrect: false },
          { text: "Codominance", isCorrect: true },
          { text: "Epistasis", isCorrect: false },
          { text: "Polygenic inheritance", isCorrect: false },
        ] },
      { type: "true_false", question: "In incomplete dominance, the heterozygote shows a blended phenotype.", points: 1,
        options: [
          { text: "True", isCorrect: true },
          { text: "False", isCorrect: false },
        ] },
    ];
    for (const it of liveItems) {
      const item = await QuizItem.create({
        quizId: liveQuiz._id, type: it.type, question: it.question,
        correctAnswer: it.correct_answer || "", points: it.points || 1, sortOrder: 0,
      });
      if (it.options) {
        await QuizOption.insertMany(it.options.map((o, i) => ({ itemId: item._id, text: o.text, isCorrect: o.is_correct, sortOrder: i })));
      }
    }
    console.log("✓ Live quiz seeded");
  }

  // ===== Flashcards =====
  const flashcards = [
    { front: "Gene", back: "A segment of DNA that codes for a specific trait." },
    { front: "Allele", back: "An alternative form of a gene (e.g. T or t)." },
    { front: "Genotype", back: "The specific allele combination an organism carries (e.g. Tt)." },
    { front: "Phenotype", back: "The observable physical expression of the genotype." },
    { front: "Law of Segregation", back: "Allele pairs separate during gamete formation; each gamete gets one allele." },
    { front: "9:3:3:1 ratio", back: "F2 phenotype ratio of a dihybrid cross." },
    { front: "Incomplete dominance", back: "Heterozygote shows a blended phenotype." },
    { front: "Codominance", back: "Both alleles expressed fully in heterozygote (e.g. AB blood type)." },
    { front: "X-linked recessive", back: "Disorders more common in males — they have only one X chromosome." },
    { front: "Carrier", back: "A heterozygous individual who is phenotypically normal but can pass on a recessive allele." },
  ];
  for (const f of flashcards) {
    await Flashcard.findOneAndUpdate({ front: f.front }, f, { upsert: true });
  }
  console.log(`✓ ${flashcards.length} flashcards seeded`);

  // ===== Settings singleton =====
  await Settings.getSingleton();
  console.log(`✓ Settings row ensured`);

  console.log("\n✅ Seed complete. No accounts were created — visit /register to sign up.");
  console.log("   The first registered account becomes the administrator.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
