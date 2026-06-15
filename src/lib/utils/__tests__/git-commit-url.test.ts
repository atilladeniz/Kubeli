import { gitCommitUrl } from "../git-commit-url";

const SHA = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

describe("gitCommitUrl", () => {
  it("builds a GitHub commit URL and strips the .git suffix", () => {
    expect(
      gitCommitUrl("https://github.com/example/demo-app.git", SHA),
    ).toBe(`https://github.com/example/demo-app/commit/${SHA}`);
  });

  it("handles scp-style git@ remotes", () => {
    expect(gitCommitUrl("git@github.com:example/demo-app.git", SHA)).toBe(
      `https://github.com/example/demo-app/commit/${SHA}`,
    );
  });

  it("uses /commits/ for Bitbucket", () => {
    expect(
      gitCommitUrl("https://bitbucket.org/team/repo.git", SHA),
    ).toBe(`https://bitbucket.org/team/repo/commits/${SHA}`);
  });

  it("accepts short SHAs of at least 7 hex chars", () => {
    expect(gitCommitUrl("https://github.com/a/b", "abc1234")).toBe(
      "https://github.com/a/b/commit/abc1234",
    );
  });

  it("returns null for non-SHA revisions like branches and tags", () => {
    expect(gitCommitUrl("https://github.com/a/b", "main")).toBeNull();
    expect(gitCommitUrl("https://github.com/a/b", "v1.0.0")).toBeNull();
  });

  it("returns null for empty or non-http repo URLs", () => {
    expect(gitCommitUrl("", SHA)).toBeNull();
    expect(gitCommitUrl("not a url", SHA)).toBeNull();
  });
});
