import { info, error, startGroup, endGroup, setFailed } from "@actions/core";
import { exec } from "@actions/exec";
import { Octokit } from "@octokit/action";

function expect(actionName, exitCode)
{
    if (exitCode !== 0) {
        setFailed(`Error ${actionName}`);
        process.exit();
    }
}

function missingEnv(varName) {
    throw new Error(`Missing environment variable: ${varName}`);
}

const baseBranch = process.env.BASE_BRANCH || "main";
const LIBRARY = process.env.LIBRARY || missingEnv("LIBRARY");
const VERSION = process.env.VERSION || missingEnv("VERSION");

const octokit = new Octokit();

startGroup("Fetching actor information");
const actorResponse = await octokit.users.getByUsername({ username: process.env.GITHUB_ACTOR });
if (`${actorResponse.status}` !== "200") {
    error(`Response: ${JSON.stringify(actorResponse, null, '  ')}`)
    setFailed(`Error fetching information for actor '${process.env.GITHUB_ACTOR}'`);
    process.exit();
}
endGroup();

startGroup("Create and push new branch");
const branchName = `update/${LIBRARY}-${VERSION}`;
await exec("git", ["status"]); // For debugging

// Set committer information
await exec("git", ["config", "user.name", `${actorResponse.data.name}`]);
await exec("git", ["config", "user.email", `${actorResponse.data.email}`]);

// Stash changes
info("Stashing changes");
expect("stashing changes", await exec("git", ["stash", "push", "*.csproj"]));
// Pull updates
expect("pulling updates", await exec("git", ["pull"]));
// Pop stash
expect("popping stash", await exec("git", ["stash", "pop"]))
// Create new branch
info(`Creating new branch: ${branchName}`);
expect("creating new branch", await exec("git", ["checkout", "-b", branchName]));
// Add changes
expect("adding changes", await exec("git", ["add", "."]));
// Commit changes
info("Committing changes to new branch");
expect("committing changes", await exec("git", ["commit", "-m", `Updating ${LIBRARY} to ${VERSION}`]));
// Push new branch
info("Pushing new branch");
let exitCode = await exec("git", ["push", "--progress", "--set-upstream", "origin", branchName]);
if (exitCode !== 0) {
    // Debug info if we can't push
    await exec("git", ["branch", "-vv"]);
    await exec("git", ["remote", "-vv"])

    setFailed("Error committing changes.");
    process.exit();
}
endGroup();

startGroup("Create pull request")
const response = await octokit.pulls.create({
    owner: process.env.GITHUB_REPOSITORY_OWNER,
    repo: process.env.GITHUB_REPOSITORY.split('/')[1],
    base: baseBranch,
    head: `update/${LIBRARY}-${VERSION}`,
    title: `Update ${LIBRARY} to ${VERSION}`,
    body: `This pull request updates \`${LIBRARY}\` to \`${VERSION}\`.`,
});
info(`Pull request response: ${JSON.stringify(response, null, '  ')}`);
endGroup();
