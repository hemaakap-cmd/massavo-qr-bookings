import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";

interface SEOProps {
  title: string;
  description: string;
  path?: string;
  keywords?: string;
  image?: string;
  type?: "website" | "article";
  noindex?: boolean;
}

const SITE_URL = "https://massavo.com";
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;

/**
 * Per-page SEO meta tags. Renders <title>, description, canonical,
 * Open Graph and Twitter Card tags. Localizes lang attribute.
 */
export const SEO = ({
  title,
  description,
  path = "/",
  keywords,
  image = DEFAULT_IMAGE,
  type = "website",
  noindex = false,
}: SEOProps) => {
  const { i18n } = useTranslation();
  const url = `${SITE_URL}${path}`;
  const lang = i18n.language || "de";
  const ogLocale = lang === "en" ? "en_US" : "de_DE";
  const altLocale = lang === "en" ? "de_DE" : "en_US";

  const fullTitle =
    title.length > 60 ? title.slice(0, 57) + "..." : title;
  const safeDescription =
    description.length > 160 ? description.slice(0, 157) + "..." : description;

  return (
    <Helmet>
      <html lang={lang} />
      <title>{fullTitle}</title>
      <meta name="description" content={safeDescription} />
      {keywords && <meta name="keywords" content={keywords} />}
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      <link rel="canonical" href={url} />

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={safeDescription} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:locale" content={ogLocale} />
      <meta property="og:locale:alternate" content={altLocale} />
      <meta property="og:site_name" content="MASSAVO" />
      <meta property="og:image" content={image} />

      {/* hreflang */}
      <link rel="alternate" hrefLang="de" href={`${SITE_URL}${path}`} />
      <link rel="alternate" hrefLang="en" href={`${SITE_URL}${path}`} />
      <link rel="alternate" hrefLang="x-default" href={`${SITE_URL}${path}`} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={safeDescription} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
};

export default SEO;