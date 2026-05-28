"use client";

import { useMemo } from "react";
import { createAvatar } from "@dicebear/core";
import { adventurer } from "@dicebear/collection";

interface GenerativeAvatarProps {
  tokenId?: number | bigint;
  size?: number;
  animated?: boolean;
  className?: string;
  /** Optional name — used for the alt text so screen readers + broken-image fallback read sensibly. */
  name?: string;
}

export function GenerativeAvatar({
  tokenId,
  size = 40,
  animated = false,
  className = "",
  name,
}: GenerativeAvatarProps) {
  const seed = String(Number(tokenId ?? 0));
  const altText = name || (tokenId ? `Agent ${tokenId}` : "Agent");

  const dataUri = useMemo(() => {
    return createAvatar(adventurer, {
      seed,
      size: 128,
      // Purple-tinted backgrounds so adventurers blend with the 0G brand
      backgroundColor: ["F0DBFF", "E3C1FF", "CB8AFF", "B75FFF", "9200E1"],
      backgroundType: ["gradientLinear", "solid"],
      radius: 50,
      // Adventurer characters have very tall hair. Scale them way down and
      // push down so the full head + hair fits inside the circle.
      scale: 60,
      translateY: 18,
    }).toDataUri();
  }, [seed]);

  return (
    <img
      src={dataUri}
      alt={altText}
      width={size}
      height={size}
      className={`shrink-0 block rounded-full overflow-hidden ${animated ? "transition-transform duration-700 hover:rotate-3" : ""} ${className}`}
      style={{ width: size, height: size, objectFit: "cover", aspectRatio: "1 / 1" }}
    />
  );
}
