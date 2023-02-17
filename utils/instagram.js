const { FB_API_VERSION: API_VERSION } = process.env;

/**
 * Creates a container for the video in the specified Instagram account
 *
 * @param {string} igUserId - The Instagram user ID of the account to publish the video to
 * @param {string} videoUrl - The URL of the video to be published
 * @param {string} access_token - The access token for the Facebook API
 * @return {Promise<string>} - Promise that resolves to the ID of the media container
 */
const createMediaContainer = async (igUserId, videoUrl, access_token) => {
  const igMediaUri = `https://graph.facebook.com/${API_VERSION}/${igUserId}/media?media_type=REELS&video_url=${videoUrl}&access_token=${access_token}`;
  const igMediaData = await fetch(igMediaUri, { method: "POST" });
  const { id: igMediaContainerId } = await igMediaData.json();
  return igMediaContainerId;
};

/**
 * Checks the upload status of the media container until it's finished or an error occurs
 *
 * @param {string} igMediaContainerId - The ID of the media container to check
 * @param {string} access_token - The access token for the Facebook API
 * @return {Promise<void>} - Promise that resolves once the upload status is finished or an error occurs
 * @throws {Error} - Throws an error if the upload status is not finished after the maximum number of attempts
 */
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

/**
 * Retrieves the Instagram business accounts linked to the user's Facebook account.
 *
 * @async
 * @param {string} access_token - The access token to use to authenticate the request to Facebook's Graph API.
 * @returns {Promise<Array>} An array of objects containing information about the Instagram business accounts.
 * @throws {Error} If an error occurs while retrieving the data from Facebook's Graph API.
 */
async function getAccountsFromFacebookApi(access_token) {
  const uri = `https://graph.facebook.com/${API_VERSION}/me/accounts?fields=instagram_business_account{id,name,username},name&access_token=${access_token}`;
  const accountResponse = await fetch(uri);
  const { data: accountData, error } = await accountResponse.json();
  if (error) {
    throw new Error(error.message);
  }
  return accountData;
}

/**
 * Retrieves the Instagram username associated with the specified Instagram business account.
 *
 * @async
 * @param {string} access_token - The access token to use to authenticate the request to Facebook's Graph API.
 * @param {string} accountId - The ID of the Instagram business account.
 * @returns {Promise<string>} The Instagram username associated with the account.
 */
async function getInstagramUsernameForAccount(access_token, accountId) {
  const igUsernameUri = `https://graph.facebook.com/${API_VERSION}/${accountId}?fields=username&access_token=${access_token}`;
  const usernameResponse = await fetch(igUsernameUri);
  const { username } = await usernameResponse.json();
  return username;
}

/**
 * Get the Instagram user ID associated with a Facebook Page ID using the given access token.
 *
 * @async
 * @param {string} pageId - The ID of the Facebook Page.
 * @param {string} access_token - The access token to use for making API requests.
 * @returns {Promise<string>} A Promise that resolves with the Instagram user ID.
 */
const getInstagramUserId = async (pageId, access_token) => {
  const igUserUri = `https://graph.facebook.com/${API_VERSION}/${pageId}?fields=instagram_business_account&access_token=${access_token}`;
  const igUserData = await fetch(igUserUri);
  const {
    instagram_business_account: { id },
  } = await igUserData.json();
  return id;
};

module.exports = {
  createMediaContainer,
  checkUploadStatus,
  getAccountsFromFacebookApi,
  getInstagramUsernameForAccount,
  getInstagramUserId,
};
