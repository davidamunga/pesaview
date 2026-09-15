/**
 * User-facing changelog lines for GitHub Releases and CHANGELOG.md.
 *
 * Sentence first. PR as a quiet suffix. No commit SHAs. No “Thanks @me”.
 * To credit someone else, put `author: @username` in the changeset.
 */
const { getInfo, getInfoFromPullRequest } = require("@changesets/get-github-info");

function formatReleaseLine({ firstLine, futureLines, pull, thanksUsers, githubServerUrl }) {
  const thanks =
    thanksUsers.length === 0
      ? ""
      : ` Thanks ${thanksUsers
          .map((user) => `[@${user}](${githubServerUrl}/${user})`)
          .join(", ")}.`;
  const ref = pull ? ` (${pull})` : "";
  const rest = futureLines.map((line) => `  ${line}`).join("\n");
  return `\n\n- ${firstLine}${ref}${thanks}${rest ? `\n${rest}` : ""}`;
}

async function getReleaseLine(changeset, _type, options) {
  if (!options?.repo) {
    throw new Error(
      'Provide a repo: "changelog": [".changeset/changelog.cjs", { "repo": "org/repo" }]',
    );
  }

  const githubServerUrl = process.env.GITHUB_SERVER_URL || "https://github.com";
  let prFromSummary;
  let commitFromSummary;
  const thanksUsers = [];

  const replacedChangelog = changeset.summary
    .replace(/^\s*(?:pr|pull|pull\s+request):\s*#?(\d+)/im, (_, pr) => {
      const num = Number(pr);
      if (!Number.isNaN(num)) prFromSummary = num;
      return "";
    })
    .replace(/^\s*commit:\s*([^\s]+)/im, (_, commit) => {
      commitFromSummary = commit;
      return "";
    })
    .replace(/^\s*(?:author|user):\s*@?([^\s]+)/gim, (_, user) => {
      thanksUsers.push(user);
      return "";
    })
    .trim();

  const [firstLine, ...futureLines] = replacedChangelog
    .split("\n")
    .map((line) => line.trimEnd());

  let pull = null;
  const commitToFetch = commitFromSummary || changeset.commit;
  if (prFromSummary !== undefined) {
    const info = await getInfoFromPullRequest({
      repo: options.repo,
      pull: prFromSummary,
    });
    pull = info.links.pull;
  } else if (commitToFetch) {
    const info = await getInfo({
      repo: options.repo,
      commit: commitToFetch,
    });
    pull = info.links.pull;
  }

  return formatReleaseLine({
    firstLine,
    futureLines,
    pull,
    thanksUsers,
    githubServerUrl,
  });
}

async function getDependencyReleaseLine() {
  return "";
}

module.exports = {
  formatReleaseLine,
  getReleaseLine,
  getDependencyReleaseLine,
};
