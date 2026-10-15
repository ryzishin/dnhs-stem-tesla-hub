// src/models/ContentBlock.js
import mongoose from "mongoose";

const contentBlockSchema = new mongoose.Schema(
  {
    partId: { type: mongoose.Schema.Types.ObjectId, ref: "Part", required: true, index: true },
    kind: {
      type: String,
      enum: ["paragraph", "heading", "bullet", "numbered", "image", "divider", "callout"],
      required: true,
    },
    sortOrder: { type: Number, default: 0 },
    // polymorphic payload:
    text: { type: String, default: "" },
    level: { type: Number, default: null }, // heading level (2 or 3)
    items: { type: [String], default: [] }, // bullet / numbered lists
    url: { type: String, default: "" }, // image url
    caption: { type: String, default: "" }, // image caption
    variant: { type: String, default: null }, // callout: info | warning | success
  },
  { timestamps: true }
);

export default mongoose.model("ContentBlock", contentBlockSchema);
