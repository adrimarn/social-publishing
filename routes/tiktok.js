const express = require("express");
const router = express.Router();
const FormData = require("form-data");
const axios = require("axios");

const {
  TIKTOK_CLIENT_KEY: CLIENT_KEY,
  TIKTOK_CLIENT_SECRET: CLIENT_SECRET,
  TIKTOK_REDIRECT_URI: REDIRECT_URI,
  TIKTOK_SCOPES: SCOPES,
} = process.env;

const STRINGIFIED_SCOPES = SCOPES.split(",").join("%2c");

/**
 * @route GET /tiktok
 * @description Redirects user to the home page.
 */
router.get("/", (req, res) => {
  res.redirect("/");
});

/**
 * @route GET /tiktok/login
 * @description Redirects user to TikTok login page with the provided parameters.
 */
router.get("/login", (req, res) => {
  const url = `https://open-api.tiktok.com/platform/oauth/connect/?client_key=${CLIENT_KEY}&response_type=code&scope=${STRINGIFIED_SCOPES}&redirect_uri=${REDIRECT_URI}`;
  res.redirect(url);
});

/**
 * @route GET /tiktok/callback
 * @description Callback endpoint for TikTok authentication. Sets session variables for access_token and open_id.
 * @async
 */
router.get("/callback", async (req, res) => {
  const { code } = req.query;
  const uri = `https://open-api.tiktok.com/oauth/access_token/?client_key=${CLIENT_KEY}&client_secret=${CLIENT_SECRET}&code=${code}&grant_type=authorization_code`;
  const { data } = await axios.get(uri);
  const { access_token, open_id } = data.data;
  req.session.access_token = access_token;
  req.session.open_id = open_id;
  res.redirect("/tiktok/upload");
});

/**
 * @route GET /tiktok/upload
 * @description Render the TikTok uploading page with user information.
 */
router.get("/upload", async (req, res) => {
  const { access_token } = req.session;
  if (!access_token) {
    res.redirect("/");
    return;
  }
  const uri = `https://open.tiktokapis.com/v2/user/info/?fields=display_name,open_id,union_id,avatar_url`;
  const { data } = await axios.get(uri, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${access_token}`,
    },
  });
  const { user } = data.data;
  req.session.user = user;
  res.render("tiktok", { user });
});

/**
 * @route POST /tiktok/upload
 * @description Uploads a video to TikTok.
 */
router.post("/upload", async (req, res) => {
  try {
    const { access_token, open_id } = req.session;

    if (!access_token) {
      res.redirect("/");
      return;
    }

    const { videoUrl } = req.body;

    // Use Axios to download the video from the specified URL as a stream
    const { data: videoStream } = await axios.get(videoUrl, {
      responseType: "stream",
    });

    // Create a new FormData object and append the video stream to it
    const formData = new FormData();
    formData.append("video", videoStream);

    // Construct the API endpoint URL using the access token and open ID
    const uploadUrl = `https://open-api.tiktok.com/share/video/upload/?access_token=${access_token}&open_id=${open_id}`;

    // Use Axios to upload the video to TikTok's servers
    const { data: responseData } = await axios.post(uploadUrl, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
        ...formData.getHeaders(),
      },
    });

    res.render("tiktok", {
      user: req.session.user,
      success: `Video uploaded successfully`,
    });
  } catch (error) {
    console.error(error);
    res.render("tiktok", {
      user: req.session.user,
      error: `Failed to upload video`,
    });
  }
});

module.exports = router;
