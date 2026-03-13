import type { NextPage } from "next";

interface ErrorProps {
  statusCode?: number;
}

const Error: NextPage<ErrorProps> = ({ statusCode }) => {
  const message =
    statusCode === 404
      ? "페이지를 찾을 수 없습니다."
      : "서버 오류가 발생했습니다.";

  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        height: "100vh",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <h1>{statusCode ?? 500}</h1>
      <p>{message}</p>
    </div>
  );
};

Error.getInitialProps = ({ res, err }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;
