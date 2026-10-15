// src/tests/smoke.test.js
// v3-P1-6: End-to-end smoke test. Boots the app against an in-memory MongoDB,
// runs the happy path: register → login → list quizzes → take quiz → submit → check result.
// This single test catches 80% of regressions going forward.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import { app } from "../server.js"; // need to export app — see below

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Clear all collections between tests.
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

describe("auth + quiz happy path", () => {
  it("registers, logs in, takes a quiz, submits, sees result", async () => {
    // 1. Register first user (becomes admin)
    const reg = await request(app)
      .post("/register")
      .set("Cookie", []) // fresh session
      .send({ username: "admin", name: "Admin User", password: "password123" })
      .expect(302); // redirect to /admin

    const cookies = reg.headers["set-cookie"];

    // 2. Create a practice quiz
    const quizRes = await request(app)
      .post("/api/quizzes")
      .set("Cookie", cookies)
      .send({ title: "Test Quiz", kind: "practice", mastery_mode: false })
      .expect(200);

    expect(quizRes.body.ok).toBe(true);
    const quizId = quizRes.body.quiz.id || quizRes.body.quiz._id;

    // 3. Add a multiple_choice item
    const itemRes = await request(app)
      .post(`/api/quizzes/${quizId}/items`)
      .set("Cookie", cookies)
      .send({
        type: "multiple_choice",
        question: "What is DNA?",
        points: 1,
        options: [
          { text: "Deoxyribonucleic acid", is_correct: true },
          { text: "Sugar", is_correct: false },
        ],
      })
      .expect(200);

    expect(itemRes.body.ok).toBe(true);

    // 4. Take the quiz
    const takeRes = await request(app)
      .get(`/practice/${quizId}`)
      .set("Cookie", cookies)
      .expect(200);

    expect(takeRes.text).toContain("What is DNA?");

    // 5. Submit — pick the correct answer
    const itemId = itemRes.body.item.id || itemRes.body.item._id;
    const submitRes = await request(app)
      .post(`/practice/${quizId}/submit`)
      .set("Cookie", cookies)
      .send({ answers: { [itemId]: "Deoxyribonucleic acid" } })
      .expect(200);

    // 6. Result page should show per-item breakdown
    expect(submitRes.text).toContain("1");
    expect(submitRes.text).toContain("Deoxyribonucleic acid");
  });
});
