const axios = require("axios");

const { TIKTOK_CLIENT_KEY, FB_APP_ID, FB_API_SECRET, FB_API_VERSION } =
    process.env;

/**
 * Refreshes the access token for a given social media provider.
 *
 * @async
 * @param {object} socialProvider - The social media provider object to refresh the access token for.
 * @param {string} socialProvider.provider - The name of the social media provider. Either "tiktok" or "instagram".
 * @param {string} socialProvider.accessToken - The current access token.
 * @param {string} socialProvider.refreshToken - The refresh token to use to obtain a new access token.
 * @returns {Promise<object>} A new socialProvider object with updated access_token and refresh_token
 *                           and tiktokOpenId if the provider is TikTok
 * @throws {Error} If the social provider is not supported or an error occurs while refreshing the access token.
 */
async function refreshAccessToken(socialProvider) {
    let url, params;

    // Determine which social media provider is being used and set the appropriate url and parameters
    switch (socialProvider.provider) {
        case "tiktok":
            url = "https://open-api.tiktok.com/oauth/refresh_token/";
            params = {
                grant_type: "refresh_token",
                refresh_token: socialProvider.refreshToken,
                client_key: TIKTOK_CLIENT_KEY,
            };
            break;

        case "instagram":
            url = `https://graph.facebook.com/${FB_API_VERSION}/oauth/access_token`;
            params = {
                grant_type: "fb_exchange_token",
                client_id: FB_APP_ID,
                client_secret: FB_API_SECRET,
                fb_exchange_token: socialProvider.accessToken,
            };
            break;

        default:
            throw new Error("Unsupported social provider");
    }

    try {
        // Send a GET request to the API to refresh the access token
        const response = await axios.get(url, { params });

        console.log(response.data);

        // Destructure the data from the response
        let access_token, refresh_token, open_id;
        if (socialProvider.provider === "tiktok") {
            ({ access_token, refresh_token, open_id } = response.data.data);
        } else if (socialProvider.provider === "instagram") {
            ({ access_token } = response.data);
        }

        // Return a new socialProvider object with the updated access token and refresh token,
        // and add the TikTok open_id property if the provider is TikTok
        return {
            ...socialProvider,
            accessToken: access_token,
            ...(socialProvider.provider === "tiktok" && {
                tiktokOpenId: open_id,
                refreshToken: refresh_token,
            }),
        };
    } catch (error) {
        console.error(
            `Error refreshing ${socialProvider.provider} access token:`,
            error
        );
        throw new Error(`Error refreshing ${socialProvider.provider} access token`);
    }
}

module.exports = refreshAccessToken;

// Example usage

//refreshAccessToken(socialProviderTikTok).then((token) => console.log(token));
//refreshAccessToken(socialProviderFacebook).then((token) => console.log(token));



