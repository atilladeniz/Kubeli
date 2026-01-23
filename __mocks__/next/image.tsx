/* eslint-disable @next/next/no-img-element */
import React from "react";

export default function Image(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  const { alt = "", ...rest } = props;

  // Use a plain img element for tests; Next.js Image optimization isn't needed here.
  return <img alt={alt} {...rest} />;
}
