import { humanizeValidationMessage, parseApiError, parseApiFieldErrors } from "../errors";

function mockResponse(
  body: unknown,
  options: { status?: number; statusText?: string; jsonThrows?: boolean } = {}
): Response {
  const { status = 400, statusText = "Bad Request", jsonThrows = false } = options;
  return {
    status,
    statusText,
    json: jsonThrows
      ? async () => {
          throw new Error("invalid json");
        }
      : async () => body,
  } as Response;
}

describe("humanizeValidationMessage", () => {
  it("replaces generic String prefix with field label", () => {
    expect(
      humanizeValidationMessage({
        loc: ["body", "title"],
        msg: "String should have at least 1 character",
        type: "string_too_short",
      })
    ).toBe("Title should have at least 1 character");
  });

  it("maps missing fields to required message", () => {
    expect(
      humanizeValidationMessage({
        loc: ["body", "description"],
        msg: "Field required",
        type: "missing",
      })
    ).toBe("Description is required.");
  });
});

describe("parseApiError", () => {
  it("returns string detail from JSON body", async () => {
    const response = mockResponse({ detail: "Invalid credentials." });
    await expect(parseApiError(response)).resolves.toBe("Invalid credentials.");
  });

  it("falls back when body is not JSON", async () => {
    const response = mockResponse(null, {
      status: 502,
      statusText: "Bad Gateway",
      jsonThrows: true,
    });
    await expect(parseApiError(response)).resolves.toBe("Bad Gateway");
  });
});

describe("parseApiFieldErrors", () => {
  it("maps validation detail array to field errors", async () => {
    const response = mockResponse({
      detail: [
        {
          loc: ["body", "title"],
          msg: "String should have at least 1 character",
          type: "string_too_short",
        },
      ],
    });
    await expect(parseApiFieldErrors(response)).resolves.toEqual({
      title: "Title should have at least 1 character",
    });
  });

  it("returns empty object for non-JSON body", async () => {
    const response = mockResponse(null, { status: 422, jsonThrows: true });
    await expect(parseApiFieldErrors(response)).resolves.toEqual({});
  });
});
