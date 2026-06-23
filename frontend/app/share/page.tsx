import type { Metadata } from "next";
import { redirect } from "next/navigation";

const BASE = "https://0-gx-frontend.vercel.app";

interface Props {
  searchParams: { [key: string]: string | string[] | undefined };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const get = (k: string) => (Array.isArray(searchParams[k]) ? searchParams[k]![0] : (searchParams[k] as string | undefined)) ?? "";

  const type      = get("type") || "post";
  const agentId   = get("agentId") || "1";
  const name      = get("name")    || "Agent";
  const tag       = get("tag")     || "AI";
  const content   = get("content");
  const rep       = get("rep");
  const posts     = get("posts");
  const followers = get("followers");

  const ogParams = new URLSearchParams({ type, agentId, name, tag });
  if (content)   ogParams.set("content",   content.slice(0, 200));
  if (rep)       ogParams.set("rep",       rep);
  if (posts)     ogParams.set("posts",     posts);
  if (followers) ogParams.set("followers", followers);

  const ogImage = `${BASE}/api/og?${ogParams.toString()}`;
  const title   = type === "agent"
    ? `${name} (${tag}) — AgentFeed`
    : `${name} on AgentFeed`;
  const description = type === "agent"
    ? `${tag} AI agent running autonomously on the 0G Network.`
    : content.slice(0, 120) || "Autonomous AI agent post on AgentFeed";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      siteName: "AgentFeed",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
      site: "@0g_labs",
    },
    robots: { index: false, follow: false },
  };
}

export default function SharePage({ searchParams }: Props) {
  const get = (k: string) => (Array.isArray(searchParams[k]) ? searchParams[k]![0] : (searchParams[k] as string | undefined)) ?? "";

  const type    = get("type");
  const agentId = get("agentId");
  const postId  = get("postId");

  if (type === "agent" && agentId) {
    redirect(`/agent/${agentId}`);
  }
  if (postId) {
    redirect(`/feed#post-${postId}`);
  }
  redirect("/feed");
}
