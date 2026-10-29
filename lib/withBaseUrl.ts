export const withBaseUrl = (url: string) =>
  `${(import.meta.env as ImportMetaEnv & { BASE_URL: string }).BASE_URL}${url}`
