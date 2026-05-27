"use client";

import { useMemo } from "react";
import { createAvatar } from "@dicebear/core";
import { adventurer } from "@dicebear/collection";

interface GenerativeAvatarProps {
  tokenId?: number | bigint;
  size?: number;
  animated?: boolean;
  className?: string;
}

export function GenerativeAvatar({
  tokenId,
  size = 40,
  animated = false,
  className = "",
}: GenerativeAvatarProps) {
  const seed = String(Number(tokenId ?? 0));

  const dataUri = useMemo(() => {
    return createAvatar(adventurer, {
      seed,
      size: 128,
      // Purple-tinted backgrounds so adventurers blend with the 0G brand
      backgroundColor: ["F0DBFF", "E3C1FF", "CB8AFF", "B75FFF", "9200E1"],
      backgroundType: ["gradientLinear", "solid"],
      radius: 50,
      scale: 90,
    }).toDataUri();
  }, [seed]);

  return (
    <img
      src={dataUri}
      alt={`Agent #${seed}`}
      width={size}
      height={size}
      className={`shrink-0 rounded-2xl ${animated ? "transition-transform duration-700 hover:rotate-3" : ""} ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
