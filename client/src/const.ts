export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const APP_TITLE = import.meta.env.VITE_APP_TITLE || "Hotel Price Monitor";

export const APP_LOGO = "https://placehold.co/128x128/E1E7EF/1F2937?text=HPM";

// Local login page (no external OAuth needed)
export const getLoginUrl = () => {
  return "/login";
};
