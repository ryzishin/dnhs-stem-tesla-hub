// scripts/seed.js — fills the database with real starter content for four subjects.
//   npm run db:seed
// Safe to re-run: it replaces subjects/notes/quizzes/decks + settings, and never touches users.
import "dotenv/config";
import mongoose from "mongoose";
import { Note, Deck, Quiz, Subject, Settings } from "../src/models/index.js";

const MONGODB_URI = process.env.MONGODB_URI || "";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "stem_tesla_hub";
if (!MONGODB_URI) { console.error("MONGODB_URI is missing — see .env.example."); process.exit(1); }

await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB_NAME, serverSelectionTimeoutMS: 15000 });
console.log("[seed] connected to MongoDB (" + MONGODB_DB_NAME + ")");

// ---------- content ----------
const bioNote = {
  title: "How Traits Travel Through Generations",
  blurb: "Mendel's rules, Punnett squares, and how DNA becomes the traits you see.",
  blocks: [
    { type: "paragraph", text: "Heredity is the passing of traits from parents to offspring through DNA. Every organism carries two copies of each gene — one inherited from each parent — and it is the combination of those copies that decides what you actually see: eye color, seed shape, blood type." },
    { type: "heading", level: 2, text: "Mendel's Big Idea" },
    { type: "paragraph", text: "Gregor Mendel, a monk growing pea plants in the 1860s, discovered that traits are inherited in whole units, not blended like paint. By counting thousands of plants, he showed that each parent contributes one copy of every gene, and some copies can mask others across generations." },
    { type: "keyterm", term: "gene", definition: "A stretch of DNA that carries instructions for one trait — say, flower color or seed shape." },
    { type: "keyterm", term: "allele", definition: "One specific version of a gene. An organism holds two alleles per gene, which may match or differ." },
    { type: "callout", variant: "tip", text: "Dominant does not mean common. A dominant allele only means it shows up when present — it has nothing to do with how many organisms carry it." },
    { type: "heading", level: 2, text: "The Two Rules of Inheritance" },
    { type: "numbered", items: [
      "Law of segregation — the two alleles of a gene separate when gametes form, so each egg or sperm carries exactly one copy.",
      "Law of independent assortment — genes for different traits are passed on independently of each other, which is why traits combine in new ways every generation.",
    ] },
    { type: "keyterm", term: "genotype", definition: "The allele pair an organism actually carries, written with letters like TT, Tt, or tt." },
    { type: "keyterm", term: "phenotype", definition: "The visible trait those alleles produce — tall stem, purple flower, attached earlobes." },
    { type: "heading", level: 2, text: "Predicting with Punnett Squares" },
    { type: "paragraph", text: "A Punnett square is a 2-by-2 grid that lays out every allele pairing a cross can produce. Cross two heterozygous tall plants (Tt × Tt) and the boxes come out 1 TT : 2 Tt : 1 tt — three tall phenotypes for every one short, the classic 3:1 ratio." },
    { type: "bullets", items: [
      "Homozygous = both alleles are the same (TT or tt).",
      "Heterozygous = the alleles differ (Tt).",
      "A test cross against a homozygous recessive parent reveals an unknown genotype.",
    ] },
    { type: "heading", level: 2, text: "From DNA to Trait" },
    { type: "paragraph", text: "Genes work by coding for proteins. DNA is transcribed into RNA in the nucleus, the RNA is translated into a protein at the ribosome, and the protein does the job that produces the trait — the flow biologists call the central dogma. A change in the DNA sequence, a mutation, can change that protein and therefore the trait." },
    { type: "callout", variant: "warn", text: "Mutations are not automatically bad. Many are silent, some are harmful, and a few are useful — they are the raw material evolution works with." },
    { type: "divider" },
  ],
  sources: [
    { label: "OpenStax Biology 2e — Ch. 12: Mendel's Experiments and Heredity", url: "https://openstax.org/books/biology-2e/pages/12-introduction" },
    { label: "OpenStax Biology 2e — Ch. 14: DNA Structure and Function", url: "https://openstax.org/books/biology-2e/pages/14-introduction" },
    { label: "Khan Academy — Heredity unit", url: "https://www.khanacademy.org/science/biology/classical-genetics" },
  ],
};

const bioQuizItems = [
  { type: "mcq", question: "An organism with two identical alleles for a trait (like TT) is called…", points: 1,
    options: [
      { text: "Homozygous", isCorrect: true }, { text: "Heterozygous", isCorrect: false },
      { text: "A hybrid", isCorrect: false }, { text: "Recessive", isCorrect: false },
    ],
    explanation: "Homo- means same. Two matching alleles (TT or tt) = homozygous; two different alleles (Tt) = heterozygous." },
  { type: "tf", question: "A dominant allele shows its effect even when only one copy is present.", points: 1, answer: "true",
    explanation: "That is exactly what dominance means: one copy is enough for the trait to appear." },
  { type: "mcq", question: "Crossing Tt × Tt gives which phenotype ratio?", points: 1,
    options: [
      { text: "3 tall : 1 short", isCorrect: true }, { text: "1 tall : 1 short", isCorrect: false },
      { text: "All short", isCorrect: false }, { text: "2 tall : 2 short", isCorrect: false },
    ],
    explanation: "The Punnett square gives TT, Tt, Tt, tt — three tall (T is dominant) and one short." },
  { type: "short", question: "What molecule carries hereditary information in cells?", points: 1, answer: "DNA",
    explanation: "Deoxyribonucleic acid — DNA — stores the instructions every gene is written in." },
  { type: "mcq", question: "During gamete formation, the two alleles of a gene…", points: 1,
    options: [
      { text: "Separate, so each gamete gets one copy", isCorrect: true }, { text: "Stay together in every gamete", isCorrect: false },
      { text: "Blend into an average", isCorrect: false }, { text: "Double in number", isCorrect: false },
    ],
    explanation: "This is Mendel's law of segregation — the foundation of Punnett square predictions." },
];

const bioDeck = [
  { front: "Gene", back: "A DNA segment that codes instructions for one trait." },
  { front: "Allele", back: "One version of a gene; you carry two per gene." },
  { front: "Dominant allele", back: "Shows its trait even with only one copy present (written as a capital letter)." },
  { front: "Recessive allele", back: "Only shows its trait when both copies are recessive (lowercase)." },
  { front: "Genotype", back: "The allele pair carried — TT, Tt, or tt." },
  { front: "Phenotype", back: "The observable trait the genotype produces." },
  { front: "Homozygous", back: "Both alleles in the pair are identical (TT or tt)." },
  { front: "Heterozygous", back: "The two alleles differ (Tt)." },
];

const bioLiveItems = [
  { type: "mcq", question: "Which genotype shows the recessive trait?", points: 1,
    options: [{ text: "tt", isCorrect: true }, { text: "TT", isCorrect: false }, { text: "Tt", isCorrect: false }, { text: "Tt and TT", isCorrect: false }],
    explanation: "A recessive trait only appears when no dominant allele is present." },
  { type: "tf", question: "Genotype is what you see; phenotype is the alleles carried.", points: 1, answer: "false",
    explanation: "It's the reverse: genotype is the allele pair, phenotype is the visible trait." },
  { type: "mcq", question: "Tt × tt — what fraction of offspring is expected to be tall?", points: 1,
    options: [{ text: "1/2", isCorrect: true }, { text: "1/4", isCorrect: false }, { text: "3/4", isCorrect: false }, { text: "All", isCorrect: false }],
    explanation: "The Punnett square gives Tt, Tt, tt, tt — half tall, half short." },
  { type: "mcq", question: "Genes are located on…", points: 1,
    options: [{ text: "Chromosomes", isCorrect: true }, { text: "Ribosomes", isCorrect: false }, { text: "The cell membrane", isCorrect: false }, { text: "Vacuoles", isCorrect: false }],
    explanation: "Genes are segments of DNA organized into chromosomes." },
  { type: "short", question: "Mendel experimented with which plant?", points: 1, answer: "pea",
    explanation: "Pea plants — fast-growing, self-pollinating, with clear trait variations." },
];

const chemNote = {
  title: "Solutions & Concentration",
  blurb: "Molarity, dilution, and the math behind every solution you'll make this semester.",
  blocks: [
    { type: "paragraph", text: "A solution is a homogeneous mixture: one substance (the solute) dissolves completely into another (the solvent). Seawater, rubbing alcohol, and sugar in tea are all solutions. In chemistry the solvent is usually water, and the hard part is describing exactly how much solute is in it — the concentration." },
    { type: "keyterm", term: "aqueous (aq)", definition: "A solution where water is the solvent." },
    { type: "heading", level: 2, text: "Molarity: the workhorse unit" },
    { type: "keyterm", term: "molarity (M)", definition: "Moles of solute per liter of solution: M = mol / L. A 1.0 M solution has one mole of solute in every liter of solution." },
    { type: "paragraph", text: "Example: dissolve 0.50 mol of NaCl in enough water to make 2.0 L of solution. M = 0.50 mol / 2.0 L = 0.25 M. Read it as 'zero-point-two-five molar sodium chloride'." },
    { type: "callout", variant: "tip", text: "Volume must be in liters. If a problem gives milliliters, divide by 1000 before you divide by moles — this is the single most common slip in quiz questions." },
    { type: "heading", level: 2, text: "Dilution: same moles, more water" },
    { type: "paragraph", text: "Diluting adds solvent, which spreads the same number of solute particles through a bigger volume. Moles don't change, so concentration falls. The shortcut equation is M₁V₁ = M₂V₂, and it works with any volume unit as long as both sides match." },
    { type: "paragraph", text: "Example: to make 500 mL of 0.10 M HCl from a 1.0 M stock: V₁ = (0.10 × 500) / 1.0 = 50 mL of stock, then add water up to 500 mL." },
    { type: "callout", variant: "warn", text: "Lab safety: always add acid to water, never water to acid, and dilute slowly with stirring." },
    { type: "heading", level: 2, text: "Molality and mass percent" },
    { type: "keyterm", term: "molality (m)", definition: "Moles of solute per kilogram of solvent: m = mol / kg. Unlike molarity it doesn't change with temperature, because mass doesn't change." },
    { type: "paragraph", text: "Mass percent is mass of solute divided by total mass, times 100 — the unit you'll meet on household labels like 3% hydrogen peroxide." },
    { type: "divider" },
  ],
  sources: [
    { label: "OpenStax Chemistry 2e — Ch. 6: Composition of Substances and Solutions", url: "https://openstax.org/books/chemistry-2e/pages/6-introduction" },
    { label: "OpenStax Chemistry 2e — Ch. 11: Solutions and Colloids", url: "https://openstax.org/books/chemistry-2e/pages/11-introduction" },
    { label: "Khan Academy — Molarity", url: "https://www.khanacademy.org/science/chemistry/states-of-matter-and-intermolecular-forces" },
  ],
};

const chemQuizItems = [
  { type: "mcq", question: "The units of molarity are…", points: 1,
    options: [{ text: "mol / L", isCorrect: true }, { text: "mol / kg", isCorrect: false }, { text: "g / mol", isCorrect: false }, { text: "L / mol", isCorrect: false }],
    explanation: "mol/L is molarity (M); mol/kg is molality (m) — don't mix them up." },
  { type: "mcq", question: "Dissolving 2.0 mol of solute to make 0.50 L of solution gives…", points: 1,
    options: [{ text: "4.0 M", isCorrect: true }, { text: "0.25 M", isCorrect: false }, { text: "1.0 M", isCorrect: false }, { text: "2.5 M", isCorrect: false }],
    explanation: "M = mol / L = 2.0 / 0.50 = 4.0 M." },
  { type: "tf", question: "When you dilute a solution, the number of moles of solute stays the same.", points: 1, answer: "true",
    explanation: "Dilution only adds solvent — no solute leaves, so moles are constant and concentration drops." },
  { type: "short", question: "Using M₁V₁ = M₂V₂: how many mL of 1.0 M stock make 500 mL of 0.10 M solution?", points: 1, answer: "50",
    explanation: "V₁ = (M₂ × V₂) / M₁ = (0.10 × 500) / 1.0 = 50 mL, then add water to the 500 mL mark." },
  { type: "mcq", question: "Why does molality ignore temperature changes?", points: 1,
    options: [
      { text: "It uses mass, which doesn't change with temperature", isCorrect: true },
      { text: "It uses volume, which expands", isCorrect: false },
      { text: "Moles change with temperature", isCorrect: false },
      { text: "It doesn't — molality changes too", isCorrect: false },
    ],
    explanation: "Mass is temperature-independent, so molality (mol/kg) stays put while molarity (mol/L) drifts." },
];

const chemDeck = [
  { front: "Solution", back: "A homogeneous mixture — solute fully dissolved in solvent." },
  { front: "Solvent", back: "The substance doing the dissolving; usually the bigger part (often water)." },
  { front: "Solute", back: "The substance being dissolved — the smaller part." },
  { front: "Molarity (M)", back: "Moles of solute per liter of solution: mol/L." },
  { front: "Molality (m)", back: "Moles of solute per kilogram of solvent: mol/kg." },
  { front: "Dilution", back: "Adding solvent to lower concentration; moles unchanged (M₁V₁ = M₂V₂)." },
  { front: "Saturated solution", back: "Holds the maximum dissolved solute at that temperature." },
  { front: "Aqueous (aq)", back: "Water is the solvent." },
];

const physNote = {
  title: "Motion in One Dimension",
  blurb: "Distance vs displacement, velocity, acceleration, and the three equations that solve every kinematics problem.",
  blocks: [
    { type: "paragraph", text: "Kinematics is the language for describing motion — how fast, how far, and how quickly things speed up or slow down — without asking why. One dimension means motion along a straight line: a car on a straight road, a ball dropped straight down." },
    { type: "heading", level: 2, text: "Distance vs displacement" },
    { type: "keyterm", term: "distance", definition: "Total path covered. A scalar — just a number (30 m)." },
    { type: "keyterm", term: "displacement", definition: "Straight-line change in position, including direction. A vector (+15 m east, or −15 m west)." },
    { type: "paragraph", text: "Walk 5 m east, then 5 m west: distance = 10 m, but displacement = 0 — you're back where you started." },
    { type: "heading", level: 2, text: "Velocity and acceleration" },
    { type: "paragraph", text: "Average velocity is displacement over time: v = Δx / Δt. Speed is the same math without direction. Acceleration is how quickly velocity changes: a = Δv / Δt, in m/s² — 'meters per second, every second'." },
    { type: "callout", variant: "tip", text: "A negative acceleration isn't always 'slowing down' — it means velocity points in the negative direction. Always define the positive direction first." },
    { type: "heading", level: 2, text: "The kinematic equations" },
    { type: "numbered", items: [
      "v = v₀ + at — final velocity after time t at acceleration a.",
      "Δx = v₀t + ½at² — how far something travels in time t.",
      "v² = v₀² + 2aΔx — connects velocities and distance without needing time.",
    ] },
    { type: "paragraph", text: "Strategy: list what you know (v₀, v, a, t, Δx), then pick the equation that uses exactly your knowns and the one unknown you want." },
    { type: "heading", level: 2, text: "Free fall" },
    { type: "paragraph", text: "Ignore air resistance and every falling object near Earth's surface accelerates the same way: g ≈ 9.8 m/s² downward. After 1 second of falling you're moving 9.8 m/s; after 2 seconds, 19.6 m/s. The kinematic equations work unchanged — just set a = g and point it down." },
    { type: "divider" },
  ],
  sources: [
    { label: "OpenStax College Physics 2e — Ch. 2: Kinematics", url: "https://openstax.org/books/college-physics-2e/pages/2-introduction" },
    { label: "Khan Academy — One-dimensional motion", url: "https://www.khanacademy.org/science/physics/one-dimensional-motion" },
  ],
};

const physQuizItems = [
  { type: "mcq", question: "Which quantity is a vector?", points: 1,
    options: [{ text: "Displacement", isCorrect: true }, { text: "Distance", isCorrect: false }, { text: "Speed", isCorrect: false }, { text: "Time", isCorrect: false }],
    explanation: "Displacement carries direction. Distance, speed, and time are scalars." },
  { type: "tf", question: "If velocity is constant, acceleration is zero.", points: 1, answer: "true",
    explanation: "Acceleration is the change in velocity — no change, no acceleration." },
  { type: "mcq", question: "A car goes from 0 to 20 m/s in 4 s. Its average acceleration is…", points: 1,
    options: [{ text: "5 m/s²", isCorrect: true }, { text: "20 m/s²", isCorrect: false }, { text: "0.2 m/s²", isCorrect: false }, { text: "80 m/s²", isCorrect: false }],
    explanation: "a = Δv/Δt = 20/4 = 5 m/s²." },
  { type: "short", question: "Near Earth's surface, a freely falling object accelerates at about how many m/s²? (number only)", points: 1, answer: "9.8",
    explanation: "g ≈ 9.8 m/s² downward — 9.81 in most textbooks is the same answer." },
  { type: "mcq", question: "Dropping a ball, its speed after 1 s of free fall is about…", points: 1,
    options: [{ text: "9.8 m/s", isCorrect: true }, { text: "4.9 m/s", isCorrect: false }, { text: "19.6 m/s", isCorrect: false }, { text: "0 m/s", isCorrect: false }],
    explanation: "v = gt = 9.8 × 1 ≈ 9.8 m/s (from rest)." },
];

const physDeck = [
  { front: "Displacement", back: "Change in position with direction — a vector (Δx)." },
  { front: "Velocity", back: "Rate of change of displacement: Δx/Δt — a vector." },
  { front: "Acceleration", back: "Rate of change of velocity: Δv/Δt, measured in m/s²." },
  { front: "Scalar", back: "A quantity with only a size — distance, speed, time." },
  { front: "Vector", back: "A quantity with size and direction — displacement, velocity, acceleration." },
  { front: "Free fall", back: "Motion under gravity alone; a ≈ 9.8 m/s² downward." },
  { front: "Kinematics", back: "Describing motion (position, velocity, acceleration) without forces." },
  { front: "v² = v₀² + 2aΔx", back: "The time-free kinematic equation — velocities, acceleration, distance." },
];

const precalcNote = {
  title: "Conic Sections: Circles & Parabolas",
  blurb: "Slice a cone, get a curve. Read and rewrite the standard forms you'll graph all semester.",
  blocks: [
    { type: "paragraph", text: "Slice a double cone with a flat plane and the edge of the slice traces a curve: a circle, parabola, ellipse, or hyperbola — the conic sections. Greeks studied them 2,000 years ago; today they describe satellite dishes, suspension bridges, and planetary orbits." },
    { type: "heading", level: 2, text: "Circles" },
    { type: "keyterm", term: "standard form of a circle", definition: "(x − h)² + (y − k)² = r², where (h, k) is the center and r is the radius." },
    { type: "paragraph", text: "Example: (x − 2)² + (y + 1)² = 9 is a circle centered at (2, −1) with radius 3 — watch the signs: (y + 1) means k = −1." },
    { type: "callout", variant: "tip", text: "To find the center and radius from a messy equation, group x-terms and y-terms and complete the square twice." },
    { type: "heading", level: 2, text: "Parabolas" },
    { type: "keyterm", term: "vertex form of a parabola", definition: "y = a(x − h)² + k, with vertex (h, k). a > 0 opens upward; a < 0 opens downward; |a| controls how wide." },
    { type: "paragraph", text: "Example: y = 2(x + 1)² − 5 has vertex (−1, −5) and opens upward because a = +2. To convert y = x² − 6x + 1 into vertex form, complete the square: y = (x − 3)² − 8, so the vertex is (3, −8)." },
    { type: "numbered", items: [
      "Completing the square: take half of the x-coefficient, square it, add and subtract it.",
      "Group the added square with the x-terms; fold the constants together.",
      "Read off h and k from the factored form.",
    ] },
    { type: "heading", level: 2, text: "Why it matters" },
    { type: "paragraph", text: "A parabola reflects every ray to one focal point — that's why telescopes and satellite dishes are parabolic. Circles govern wheels, gears, and orbits. Once you can read the standard form, the geometry is sitting right there in the algebra." },
    { type: "divider" },
  ],
  sources: [
    { label: "OpenStax Precalculus — Ch. 10: Analytic Geometry (conic sections)", url: "https://openstax.org/books/precalculus/pages/10-introduction" },
    { label: "Khan Academy — Conic sections", url: "https://www.khanacademy.org/math/precalculus/conics-precalc" },
  ],
};

const precalcQuizItems = [
  { type: "mcq", question: "The circle (x − 1)² + (y + 2)² = 25 has center and radius…", points: 1,
    options: [{ text: "Center (1, −2), radius 5", isCorrect: true }, { text: "Center (−1, 2), radius 5", isCorrect: false }, { text: "Center (1, −2), radius 25", isCorrect: false }, { text: "Center (1, 2), radius 5", isCorrect: false }],
    explanation: "Standard form: (x − h)² + (y − k)² = r². Here h = 1, k = −2, r = √25 = 5." },
  { type: "short", question: "In (x − h)² + (y − k)² = r², the point (h, k) is called the ___ of the circle.", points: 1, answer: "center",
    explanation: "Every point on the circle is exactly r away from the center." },
  { type: "tf", question: "The parabola y = −3(x + 4)² + 1 opens downward.", points: 1, answer: "true",
    explanation: "a = −3 is negative, so it opens downward. Vertex: (−4, 1)." },
  { type: "mcq", question: "Completing the square: x² + y² − 6x = 0 becomes…", points: 1,
    options: [{ text: "(x − 3)² + y² = 9 — center (3, 0), r = 3", isCorrect: true }, { text: "(x + 3)² + y² = 9 — center (−3, 0)", isCorrect: false }, { text: "(x − 3)² + y² = 36 — r = 6", isCorrect: false }, { text: "(x − 6)² + y² = 9", isCorrect: false }],
    explanation: "Half of −6 is −3; squared is 9, added to both sides. The y-terms are already square." },
  { type: "mcq", question: "The vertex of y = 2(x + 1)² − 5 is…", points: 1,
    options: [{ text: "(−1, −5)", isCorrect: true }, { text: "(1, −5)", isCorrect: false }, { text: "(−1, 5)", isCorrect: false }, { text: "(2, −5)", isCorrect: false }],
    explanation: "Vertex form y = a(x − h)² + k: (x + 1) means h = −1, and k = −5." },
];

const precalcDeck = [
  { front: "Conic section", back: "A curve from slicing a cone: circle, parabola, ellipse, or hyperbola." },
  { front: "Circle (standard form)", back: "(x − h)² + (y − k)² = r² — center (h, k), radius r." },
  { front: "Radius", back: "Distance from the center to any point on the circle." },
  { front: "Parabola (vertex form)", back: "y = a(x − h)² + k — vertex (h, k); a > 0 opens up, a < 0 opens down." },
  { front: "Vertex", back: "The turning point of a parabola — its highest or lowest point." },
  { front: "Completing the square", back: "Rewriting a quadratic so h and k can be read off: add (b/2)²." },
  { front: "Focus", back: "The point a parabola reflects all rays to — the dish/telescope trick." },
  { front: "Ellipse", back: "The squashed-circle conic: sum of distances to two foci is constant." },
];

// ---------- subjects ----------
const subjectsData = [
  {
    slug: "biology-2", name: "General Biology 2", color: "coral", icon: "dna", order: 1,
    blurb: "Heredity, genetics, and evolution — how life passes instructions on.",
    note: bioNote, quiz: { title: "Heredity Check", blurb: "Five quick items on Mendel's rules. Unlimited retakes." }, deck: { title: "Genetics Vocabulary", blurb: "The words every heredity question uses." },
    practiceItems: bioQuizItems, deckCards: bioDeck,
    liveQuiz: { title: "Live: Genetics Round", items: bioLiveItems },
  },
  {
    slug: "chemistry-2", name: "General Chemistry 2", color: "teal", icon: "flask", order: 2,
    blurb: "Solutions, concentration math, and lab-ready calculation skills.",
    note: chemNote, quiz: { title: "Concentration Calculations", blurb: "Molarity and dilution — the math that shows up on every problem set." }, deck: { title: "Solution Terms", blurb: "The vocabulary of solutions, in eight cards." },
    practiceItems: chemQuizItems, deckCards: chemDeck,
  },
  {
    slug: "physics-1", name: "General Physics 1", color: "navy", icon: "motion", order: 3,
    blurb: "Kinematics first — describe the motion before you explain the forces.",
    note: physNote, quiz: { title: "Kinematics Warm-up", blurb: "Vectors, acceleration, and free fall." }, deck: { title: "Motion Words", blurb: "Scalar vs vector, and the words of motion." },
    practiceItems: physQuizItems, deckCards: physDeck,
  },
  {
    slug: "precalculus", name: "Pre-Calculus", color: "amber", icon: "calculator", order: 4,
    blurb: "Conics, trig, and the algebra behind every curve you'll graph.",
    note: precalcNote, quiz: { title: "Conics Basics", blurb: "Read circles and parabolas straight from their equations." }, deck: { title: "Conic Vocabulary", blurb: "The language of conic sections." },
    practiceItems: precalcQuizItems, deckCards: precalcDeck,
  },
];

// ---------- run ----------
const notesCount = await Note.countDocuments();
if (notesCount > 0 && !process.argv.includes("--force")) {
  console.log("[seed] content already exists (" + notesCount + " notes). Re-run with --force to replace it.");
  await mongoose.disconnect();
  process.exit(0);
}
if (process.argv.includes("--force")) {
  await Promise.all([
    Note.deleteMany({}), Deck.deleteMany({}), Quiz.deleteMany({}), Subject.deleteMany({}),
  ]);
  console.log("[seed] --force: cleared existing subjects and content");
}

for (const s of subjectsData) {
  const subject = await Subject.findOneAndUpdate(
    { slug: s.slug },
    { slug: s.slug, name: s.name, blurb: s.blurb, color: s.color, icon: s.icon, order: s.order, archived: false },
    { upsert: true, new: true }
  );
  await Note.create({ subject: subject._id, slug: s.slug + "-" + s.note.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50), title: s.note.title, blurb: s.note.blurb, order: 1, published: true, blocks: s.note.blocks, sources: s.note.sources });
  await Quiz.create({ subject: subject._id, title: s.quiz.title, blurb: s.quiz.blurb, mode: "practice", published: true, items: s.practiceItems });
  await Deck.create({ subject: subject._id, title: s.deck.title, blurb: s.deck.blurb, order: 1, published: true, cards: s.deckCards });
  if (s.liveQuiz) await Quiz.create({ subject: subject._id, title: s.liveQuiz.title, blurb: "Hosted live in class — the server scores, you watch the standings climb.", mode: "live", published: true, items: s.liveQuiz.items });
  console.log("[seed] subject ready: " + s.name);
}

await Settings.findOneAndUpdate({ _id: "main" }, { _id: "main" }, { upsert: true });
console.log("[seed] settings ready");
console.log("[seed] done. First person to register becomes the adviser (admin).");
await mongoose.disconnect();
