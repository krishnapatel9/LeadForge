"use client";

import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ padding: "64px 0", textAlign: "center" }}>
      <h1>404</h1>
      <p className="sub" style={{ margin: "12px auto 24px" }}>
        The requested resource does not exist or has been moved.
      </p>
      <Link href="/" className="btn p">
        Return to Pipeline
      </Link>
    </div>
  );
}
