// src/middleware/validate.js
// v2-P1-4: Validate req.body against a Zod schema. On success, attach the parsed
// (and coerced/defaults-applied) data to req.validated. On failure, return 400 with the issues.
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        ok: false,
        error: "Validation failed",
        issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    req.validated = result.data;
    next();
  };
}
