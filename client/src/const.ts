export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const getLoginUrl = () => {
  const googleClientId = "464573134892-d1tv22fkq5ru7s9h6fg9prtcppln708g.apps.googleusercontent.com";
  const redirectUri = "https://gamingitem-mm.shop/api/auth/callback/google";
  
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", googleClientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "select_account");
  
  return url.toString();
};
