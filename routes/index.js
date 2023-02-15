const express = require("express");
const router = express.Router();

const { REDIRECT_URI, APP_ID, API_SECRET } = process.env;

// Access scopes required for the token
const SCOPES = [
  "pages_read_engagement",
  "pages_show_list",
  "instagram_basic",
  "instagram_content_publish",
];
const STRINGIFIED_SCOPES = SCOPES.join("%2c");

router.get("/", async (req, res, next) => {
  res.render("index", { title: "Instagram" });
});

router.get("/login", async (req, res) => {
  res.redirect(
    `https://www.facebook.com/dialog/oauth?app_id=${APP_ID}&scope=${STRINGIFIED_SCOPES}&client_id=${APP_ID}&redirect_uri=${REDIRECT_URI}&response_type=code`
  );
});

router.get("/callback", async function (req, res) {
  const code = req.query.code;
  const uri = `https://graph.facebook.com/oauth/access_token?client_id=${APP_ID}&redirect_uri=${REDIRECT_URI}&client_secret=${API_SECRET}&code=${code}`;
  const response = await fetch(uri);
  const data = await response.json();
  const { access_token } = data;
  req.session.access_token = access_token;
  res.redirect("/create");
});

router.get("/create", async function (req, res) {
  const { access_token } = req.session;
  if (!access_token) res.redirect("/");
  try {
    const uri = `https://graph.facebook.com/v16.0/me/accounts?access_token=${access_token}`;
    const response = await fetch(uri);
    const data = await response.json();
    const { data: pages } = data;
    res.render("create", { pages });
  } catch (err) {
    res.render("index", {
      error: `There was an error with the request: ${err}`,
    });
  }
});

const getInstagramUserId = async (pageId, access_token) => {
  const igUserUri = `https://graph.facebook.com/v16.0/${pageId}?fields=instagram_business_account&access_token=${access_token}`;
  const igUserData = await fetch(igUserUri);
  const igUser = await igUserData.json();
  const {
    instagram_business_account: { id },
  } = igUser;
  return id;
};

const createMediaContainer = async (igUserId, videoUrl, access_token) => {
  const igMediaUri = `https://graph.facebook.com/v16.0/${igUserId}/media?media_type=REELS&video_url=${videoUrl}&access_token=${access_token}`;
  const igMediaData = await fetch(igMediaUri, { method: "POST" });
  const igMedia = await igMediaData.json();
  const { id: igMediaContainerId } = igMedia;
  return igMediaContainerId;
};

const checkUploadStatus = async (igMediaContainerId, access_token) => {
  const MAX_ATTEMPTS = 30;
  const DELAY_MS = 1000;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const igMediaContainerUri = `https://graph.facebook.com/v16.0/${igMediaContainerId}?fields=status_code&access_token=${access_token}`;
    const igMediaContainerData = await fetch(igMediaContainerUri);
    const igMediaContainer = await igMediaContainerData.json();
    const { status_code } = igMediaContainer;

    if (status_code === "FINISHED") {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  }

  throw new Error("Reached maximum number of attempts without success");
};

router.post("/publish", async function (req, res) {
  const { pageId, videoUrl } = req.body;
  const { access_token } = req.session;

  if (!access_token) {
    res.redirect("/");
    return;
  }

  try {
    const igUserId = await getInstagramUserId(pageId, access_token);

    const igMediaContainerId = await createMediaContainer(
      igUserId,
      videoUrl,
      access_token
    );

    await checkUploadStatus(igMediaContainerId, access_token);

    const igMediaPublishUri = `https://graph.facebook.com/v16.0/${igUserId}/media_publish?creation_id=${igMediaContainerId}&access_token=${access_token}`;
    const igMediaPublishData = await fetch(igMediaPublishUri, {
      method: "POST",
    });
    const igMediaPublish = await igMediaPublishData.json();
    const { id: igMediaId } = igMediaPublish;

    res.redirect("/");
  } catch (err) {
    res.render("index", {
      error: `There was an error with the request: ${err}`,
    });
  }
});

module.exports = router;
