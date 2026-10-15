// src/models/Unit.js
import mongoose from "mongoose";

const unitSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    number: { type: String, default: "01" },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    sortOrder: { type: Number, default: 0 },
    updatedAt: { type: String, default: () => new Date().toISOString().slice(0, 10) },
  },
  { timestamps: true }
);

export default mongoose.model("Unit", unitSchema);
