const express = require("express");
const {
  getAccountsFromFacebookApi,
  getInstagramUsernameForAccount,
  createMediaContainer,
  checkUploadStatus,
} = require("../utils/instagram");
const router = express.Router();

const {
  FB_REDIRECT_URI: REDIRECT_URI,
  FB_APP_ID: APP_ID,
  FB_API_SECRET: API_SECRET,
  FB_API_VERSION: API_VERSION,
} = process.env;

const SCOPES = process.env.FB_SCOPES.split(",");

const STRINGIFIED_SCOPES = SCOPES.join("%2c");

/**
 * @route GET /insta
 * @description Redirects to the home page.
 */
router.get("/", (req, res) => {
  res.redirect("/");
});

/**
 * @route GET /insta/login
 * @description Redirects to the Facebook login page to authenticate the user.
 */
router.get("/login", (req, res) => {
  const url = `https://www.facebook.com/dialog/oauth?app_id=${APP_ID}&scope=${STRINGIFIED_SCOPES}&client_id=${APP_ID}&redirect_uri=${REDIRECT_URI}&response_type=code`;
  res.redirect(url);
});

/**
 * @route GET /insta/callback
 * @description Callback endpoint for Facebook authentication. Sets session variable for access_token.
 */
router.get("/callback", async (req, res) => {
  const { code } = req.query;
  const uri = `https://graph.facebook.com/oauth/access_token?client_id=${APP_ID}&redirect_uri=${REDIRECT_URI}&client_secret=${API_SECRET}&code=${code}`;
  const response = await fetch(uri);
  const data = await response.json();
  const { access_token } = data;
  req.session.access_token = access_token;
  res.redirect("/insta/publish");
});

/**
 * @route GET /insta/publish
 * @description Renders the instagram publishing page.
 */
router.get("/publish", async (req, res) => {
  const { access_token } = req.session;
  if (!access_token) {
    res.redirect("/");
    return;
  }
  try {
    const accountData = await getAccountsFromFacebookApi(access_token);
    const accountList = accountData.filter(
      ({ instagram_business_account }) => instagram_business_account
    );
    req.session.accounts = [];
    await Promise.allSettled(
      accountList.map(async ({ name, instagram_business_account: { id } }) => {
        const username = await getInstagramUsernameForAccount(access_token, id);
        req.session.accounts.push({ id, name, username });
      })
    );
    res.render("insta", { accounts: req.session.accounts });
  } catch (err) {
    console.log(err);
    res.render("index", { error: err });
  }
});

/**
 * @route POST /insta/publish
 * @description Uploads and publishes a video to Instagram
 */
router.post("/publish", async function (req, res) {
  const { igUserId, videoUrl } = req.body;
  const { access_token } = req.session;

  if (!access_token) {
    res.redirect("/");
    return;
  }

  try {
    const igMediaContainerId = await createMediaContainer(
      igUserId,
      videoUrl,
      access_token
    );

    await checkUploadStatus(igMediaContainerId, access_token);

    const igMediaPublishUri = `https://graph.facebook.com/${API_VERSION}/${igUserId}/media_publish?creation_id=${igMediaContainerId}&access_token=${access_token}`;
    const igMediaPublishData = await fetch(igMediaPublishUri, {
      method: "POST",
    });
    const igMediaPublishResponse = await igMediaPublishData.json();
    const { id: igMediaId } = igMediaPublishResponse;

    res.render("insta", {
      success: `Video #${igMediaId} published successfully`,
    });
  } catch (err) {
    console.log(err);
    res.render("insta", {
      accounts: req.session.accounts,
      error: err,
    });
  }
});

module.exports = router;
