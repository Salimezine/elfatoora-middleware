import type { ZodError } from "zod";

type Path = ZodError["issues"][number]["path"];

export function pathToString(path: Path): string {
  return path.reduce((acc: string, segment, index) => {
    if (typeof segment === "number") {
      return `${acc}[${segment}]`;
    }

    if (typeof segment === "symbol") {
      const value = String(segment); // Explicit conversion
      return index === 0 ? value : `${acc}.${value}`;
    }

    // string
    return index === 0 ? segment : `${acc}.${segment}`;
  }, "");
}

type NormalizedError = {
  path: string;
  message: string;
  code: string;
  expected?: string;
};

export function normalizeValidationErrors(
  issues: ZodError["issues"],
): NormalizedError[] {
  return issues.map((issue) => {
    // Handle unrecognized keys (path is empty)
    if (issue.code === "unrecognized_keys" && issue.keys?.length) {
      return {
        code: issue.code,
        path: issue.keys.join(", "),
        message: issue.message,
      };
    }

    return {
      code: issue.code,
      path: issue.path.length ? pathToString(issue.path) : "",
      message: issue.message,
      ...(issue.code === "invalid_type" && {
        expected: (issue as any).expected,
      }),
    };
  });
}
