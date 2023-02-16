const express = require("express");
const fs = require("fs");
const router = express.Router();
const FormData = require("form-data");
const axios = require("axios");

const {
  TIKTOK_CLIENT_KEY: CLIENT_KEY,
  TIKTOK_CLIENT_SECRET: CLIENT_SECRET,
  TIKTOK_REDIRECT_URI: REDIRECT_URI,
} = process.env;

const SCOPES = process.env.TIKTOK_SCOPES.split(",");
const STRINGIFIED_SCOPES = SCOPES.join("%2c");

router.get("/", (req, res) => {
  res.redirect("/");
});

// OAuth TikTok
router.get("/login", (req, res) => {
  const url = `https://open-api.tiktok.com/platform/oauth/connect/?client_key=${CLIENT_KEY}&response_type=code&scope=${STRINGIFIED_SCOPES}&redirect_uri=${REDIRECT_URI}`;
  res.redirect(url);
});

router.get("/callback", async (req, res) => {
  const { code, state } = req.query;
  const uri = `https://open-api.tiktok.com/oauth/access_token/?client_key=${CLIENT_KEY}&client_secret=${CLIENT_SECRET}&code=${code}&grant_type=authorization_code`;
  const response = await fetch(uri);
  const data = await response.json();
  const {
    data: { access_token, open_id },
  } = data;
  req.session.access_token = access_token;
  req.session.open_id = open_id;
  console.log("data", data);
  console.log("access_token", access_token);
  res.redirect("/tiktok/publish");
});

router.get("/publish", async (req, res) => {
  const { access_token } = req.session;
  if (!access_token) {
    res.redirect("/");
    return;
  }
  const uri = `https://open.tiktokapis.com/v2/user/info/?fields=display_name,open_id,union_id,avatar_url`;
  const data = await fetchWithToken(uri, access_token);
  console.log("data", data);
  // get data.data.user

  const {
    data: { user },
  } = data;
  console.log("info user:", user);
  res.render("tiktok", { user });
});

router.post("/publish", async (req, res) => {
  const { access_token, open_id } = req.session;
  if (!access_token) {
    res.redirect("/");
    return;
  }
  const { videoUrl } = req.body;
  console.log("videoUrl", videoUrl);
  console.log("access_token", access_token);
  console.log("open_id", open_id);
  const uri = `https://open-api.tiktok.com/share/video/upload/?access_token=${access_token}&open_id=${open_id}`;

  // Download video URL and save to local file
  //const videoFile = await fetch(videoUrl);
  //const video = await videoFile.arrayBuffer();
  //await fs.promises.writeFile("temp.mp4", Buffer.from(video));

  console.log("videoUrl", videoUrl);
  const videoStream = await axios({
    method: "GET",
    responseType: "stream",
    url: videoUrl,
  });

  console.log("videoStream", videoStream.data)

  // Create form data with video file
  const form = new FormData();
  form.append("video", videoStream.data);

  // Upload video to TikTok using axios
  const data = await axios({
    method: "POST",
    url: uri,
    data: form,
    headers: {
      'Content-Type': 'multipart/form-data',
        ...form.getHeaders(),
    }
  });

  //console.log("data", data.data);

  res.redirect("/tiktok/publish");
});

const fetchWithToken = async (uri, token) => {
  const response = await fetch(uri, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
  });
  return await response.json();
};

module.exports = router;
