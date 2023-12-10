const { findUser } = require("../../database/controllers/user.controller.js");
const Repo = require("../../database/models/repo.model.js");
const github_helpers = require("../../providers/github/APICalls.js");
const {
  githubAuth,
  githubAuthCallback,
} = require("../../providers/github/auth.js");
const gitlab_helpers = require("../helpers/gitlab.js");
const gitlab_routes = require("./gitlab.js");

/**
 * Redirects the user to the OAuth login pages for authentication.
 * @param {*} req - object containing the client req details.
 * @param {*} res - object used to send a redirect response.
 */

// const login = (req, res) => {
//   const provider = req.query.provider;

//   if (provider === "github") {
//     github_helpers.authorizeApplication(res);
//   } else if (provider === "gitlab") {
//     gitlab_helpers.authorizeApplication(res);
//   } else {
//     res.status(400).send(`Unknown provider: ${provider}`);
//   }
// };

const reposToBadge = async (req, res) => {
  const selectedRepos = (await req.body.repos) || [];
  const userId = req.body.userId;
  const provider = req.body.provider;

  if (!provider) {
    res.status(400).send("provider missing");
    return;
  }

  if (!userId) {
    res.status(400).send("userId missing");
    return;
  }

  let user = null;
  try {
    user = await findUser(userId);
    if (!user) {
      res.status(404).json("User not found");
      return;
    }
  } catch (error) {
    res.status(500).json("Error fetching user data");
    return;
  }

  // Process the selected repos as needed
  if (provider === "github") {
    const results = await github_helpers.scanRepositories(
      user.id,
      user.name,
      user.email,
      selectedRepos
    );
    res.status(200).json({ results });
  } else if (provider === "gitlab") {
    const results = await gitlab_helpers.scanRepositories(
      user.id,
      user.name,
      user.email,
      selectedRepos
    );
    res.status(200).json({ results });
  } else {
    res.status(400).send(`Unknown provider: ${provider}`);
  }
};

const badgedRepos = async (req, res) => {
  try {
    // Use Sequelize to find all repos, excluding the DEICommitSHA field
    const repos = await Repo.findAll({
      attributes: { exclude: ["DEICommitSHA"] },
    });

    // Extract the relevant information from the repos
    const formattedRepos = repos.map((repo) => ({
      id: repo.id,
      githubRepoId: repo.githubRepoId,
      repoLink: repo.repoLink,
      badgeType: repo.badgeType,
      attachment: repo.attachment,
      createdAt: repo.createdAt,
      updatedAt: repo.updatedAt,
      userId: repo.userId,
    }));

    res.json(formattedRepos);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving repos", error });
  }
};

const setupRoutes = (app) => {
  // logins
  app.get("/api/auth/github", (req, res) => {
    githubAuth(req, res);
  });

  //redirects
  app.get("/api/callback/github", (req, res) => {
    githubAuthCallback(req, res);
  });

  app.get("/api/badgedRepos", badgedRepos);
  app.post("/api/repos-to-badge", reposToBadge);

  // github_routes.setupGitHubRoutes(app);
  gitlab_routes.setupGitLabRoutes(app);
};

module.exports = {
  setupRoutes,
};
