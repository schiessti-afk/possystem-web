import type { NextPageContext } from "next";

/**
 * Pages-router error page shim.
 *
 * App-router-only Next 14 builds do not emit
 * `.next/server/pages/_error.js`, but the production server still tries
 * to require that module whenever an error/404 response is rendered,
 * logging a MODULE_NOT_FOUND stack for every such request. Providing
 * this page makes the module real (and gives a friendly fallback).
 * It is the ONLY pages-router route; everything else stays App Router.
 */
function ErrorPage({ statusCode }: { statusCode: number }) {
  return (
    <main
      style={{
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        minHeight: "60vh",
        display: "grid",
        placeContent: "center",
        textAlign: "center",
        gap: 8,
        color: "#e7ebf5",
        background: "#0b1020",
      }}
    >
      <h1 style={{ fontSize: 42, margin: 0 }}>{statusCode}</h1>
      <p style={{ color: "#8b95ad", margin: 0 }}>
        {statusCode === 404
          ? "This page does not exist."
          : "Something went wrong rendering this page."}
      </p>
      <a href="/" style={{ color: "#4f8cff" }}>
        Back to dashboard
      </a>
    </main>
  );
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode ?? 500 : 404;
  return { statusCode };
};

export default ErrorPage;
