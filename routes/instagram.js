const express = require("express");
const router = express.Router();

const {
  FB_REDIRECT_URI: REDIRECT_URI,
  FB_APP_ID: APP_ID,
  FB_API_SECRET: API_SECRET,
  FB_API_VERSION: API_VERSION,
} = process.env;

const SCOPES = process.env.FB_SCOPES.split(",");

const STRINGIFIED_SCOPES = SCOPES.join("%2c");

router.get("/", (req, res) => {
  res.redirect("/");
});

router.get("/login", (req, res) => {
  const url = `https://www.facebook.com/dialog/oauth?app_id=${APP_ID}&scope=${STRINGIFIED_SCOPES}&client_id=${APP_ID}&redirect_uri=${REDIRECT_URI}&response_type=code`;
  res.redirect(url);
});

router.get("/callback", async (req, res) => {
  const { code } = req.query;
  const uri = `https://graph.facebook.com/oauth/access_token?client_id=${APP_ID}&redirect_uri=${REDIRECT_URI}&client_secret=${API_SECRET}&code=${code}`;
  const response = await fetch(uri);
  const data = await response.json();
  const { access_token } = data;
  req.session.access_token = access_token;
  res.redirect("/insta/publish");
});

async function getAccountsFromFacebookApi(access_token) {
  const uri = `https://graph.facebook.com/${API_VERSION}/me/accounts?fields=instagram_business_account,name&access_token=${access_token}`;
  const accountResponse = await fetch(uri);
  const { data: accountData, error } = await accountResponse.json();
  if (error) {
    throw new Error(error.message);
  }
  return accountData;
}

async function getInstagramUsernameForAccount(access_token, accountId) {
  const igUsernameUri = `https://graph.facebook.com/${API_VERSION}/${accountId}?fields=username&access_token=${access_token}`;
  const usernameResponse = await fetch(igUsernameUri);
  const { username } = await usernameResponse.json();
  return username;
}

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
    res.render("create", { accounts: req.session.accounts });
  } catch (err) {
    console.log(err);
    res.render("index", { error: err });
  }
});

// const getInstagramUserId = async (pageId, access_token) => {
//   const igUserUri = `https://graph.facebook.com/${API_VERSION}/${pageId}?fields=instagram_business_account&access_token=${access_token}`;
//   const igUserData = await fetch(igUserUri);
//   const {
//     instagram_business_account: { id },
//   } = await igUserData.json();
//   return id;
// };

const createMediaContainer = async (igUserId, videoUrl, access_token) => {
  const igMediaUri = `https://graph.facebook.com/${API_VERSION}/${igUserId}/media?media_type=REELS&video_url=${videoUrl}&access_token=${access_token}`;
  const igMediaData = await fetch(igMediaUri, { method: "POST" });
  const { id: igMediaContainerId } = await igMediaData.json();
  return igMediaContainerId;
};

const checkUploadStatus = async (igMediaContainerId, access_token) => {
  const MAX_ATTEMPTS = 30;
  const DELAY_MS = 1000;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const igMediaContainerUri = `https://graph.facebook.com/${API_VERSION}/${igMediaContainerId}?fields=status_code&access_token=${access_token}`;
    const igMediaContainerData = await fetch(igMediaContainerUri);
    const igMediaContainer = await igMediaContainerData.json();
    const { status_code, error } = igMediaContainer;

    if (error || status_code === "ERROR") {
      throw new Error(error?.message ?? "Unknown error");
    }

    if (status_code === "FINISHED") {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  }

  throw new Error("Reached maximum number of attempts without success");
};

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

    res.render("create", {
      success: `Video #${igMediaId} published successfully`,
    });
  } catch (err) {
    console.log(err);
    res.render("create", {
      accounts: req.session.accounts,
      error: err,
    });
  }
});

module.exports = router;
