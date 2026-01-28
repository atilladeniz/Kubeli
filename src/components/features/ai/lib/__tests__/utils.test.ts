import { formatRelativeTime, getSessionTitle } from "../utils";
import type { SessionSummary } from "@/lib/tauri/commands";

describe("formatRelativeTime", () => {
  const justNowLabel = "Just now";

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2024-01-15T12:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns justNowLabel for times less than 1 minute ago", () => {
    const thirtySecondsAgo = new Date("2024-01-15T11:59:30Z").toISOString();
    expect(formatRelativeTime(thirtySecondsAgo, justNowLabel)).toBe(justNowLabel);
  });

  it("returns minutes for times less than 1 hour ago", () => {
    const fiveMinutesAgo = new Date("2024-01-15T11:55:00Z").toISOString();
    expect(formatRelativeTime(fiveMinutesAgo, justNowLabel)).toBe("5m");

    const thirtyMinutesAgo = new Date("2024-01-15T11:30:00Z").toISOString();
    expect(formatRelativeTime(thirtyMinutesAgo, justNowLabel)).toBe("30m");
  });

  it("returns hours for times less than 24 hours ago", () => {
    const twoHoursAgo = new Date("2024-01-15T10:00:00Z").toISOString();
    expect(formatRelativeTime(twoHoursAgo, justNowLabel)).toBe("2h");

    const twentyThreeHoursAgo = new Date("2024-01-14T13:00:00Z").toISOString();
    expect(formatRelativeTime(twentyThreeHoursAgo, justNowLabel)).toBe("23h");
  });

  it("returns days for times less than 7 days ago", () => {
    const oneDayAgo = new Date("2024-01-14T12:00:00Z").toISOString();
    expect(formatRelativeTime(oneDayAgo, justNowLabel)).toBe("1d");

    const sixDaysAgo = new Date("2024-01-09T12:00:00Z").toISOString();
    expect(formatRelativeTime(sixDaysAgo, justNowLabel)).toBe("6d");
  });

  it("returns formatted date for times 7 days or more ago", () => {
    const sevenDaysAgo = new Date("2024-01-08T12:00:00Z").toISOString();
    const result = formatRelativeTime(sevenDaysAgo, justNowLabel);
    // Result format depends on locale, but should contain day and month
    expect(result).toMatch(/\d{1,2}/);
  });
});

describe("getSessionTitle", () => {
  it("returns the title if present", () => {
    const session: SessionSummary = {
      session_id: "test-id",
      cluster_context: "test-cluster",
      title: "My Custom Title",
      message_count: 5,
      created_at: "2024-01-15T10:00:00Z",
      last_active_at: "2024-01-15T12:00:00Z",
    };

    expect(getSessionTitle(session)).toBe("My Custom Title");
  });

  it("returns formatted date if title is empty", () => {
    const session: SessionSummary = {
      session_id: "test-id",
      cluster_context: "test-cluster",
      title: "",
      message_count: 5,
      created_at: "2024-01-15T10:30:00Z",
      last_active_at: "2024-01-15T12:00:00Z",
    };

    const result = getSessionTitle(session);
    // Should contain date components
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("returns formatted date if title is null/undefined", () => {
    const session: SessionSummary = {
      session_id: "test-id",
      cluster_context: "test-cluster",
      title: null as unknown as string,
      message_count: 5,
      created_at: "2024-01-15T10:30:00Z",
      last_active_at: "2024-01-15T12:00:00Z",
    };

    const result = getSessionTitle(session);
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });
});
