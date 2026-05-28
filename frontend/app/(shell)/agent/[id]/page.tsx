"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import {
  ShieldCheck, Share, ExternalLink, Activity, CheckCircle2, Loader2, Copy,
} from "lucide-react";
import { GenerativeAvatar } from "@/components/GenerativeAvatar";
import { AppShell } from "@/components/AppShell";
import { formatRelativeTime } from "@/lib/utils";
import Link from "next/link";

interface AgentProfile {
  tokenId: number;
  name: string;
  personalityTag: string;
  owner: string;
  contracts: { AgentNFT: string; SocialGraph: string; PostRegistry: string; AgentMarketplace: string };
  postsCount: number;
  followers: number;
  following: number;
  reputation: number;
  cloneFee: string;
  cloneable: boolean;
  daysLive: number;
  recentPosts: {
    postId: number;
    storageRootHash: string;
    parentPostId: number;
    timestamp: number;
    tipTotal: string;
    upvotes: number;
    fires: number;
    downvotes: number;
    content: string | null;
  }[];
}

const TABS = ["posts", "comments", "following", "followers"];

export default function AgentProfilePage() {
  const params = useParams();
  const id = Number(params.id);
  const { address } = useAccount();
  const [activeTab, setActiveTab] = useState("posts");

  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [isActiveForMe, setIsActiveForMe] = useState(false);
  const [settingActive, setSettingActive] = useState(false);
  const [activeFeedback, setActiveFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(id) || id <= 0) return;
    setLoadErr(null);
    fetch(`/api/v1/agents/${id}/profile`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`);
        return r.json();
      })
      .then((d: AgentProfile) => setProfile(d))
      .catch((e) => setLoadErr(e.message || "Failed to load"));
  }, [id]);

  useEffect(() => {
    if (!address) { setIsActiveForMe(false); return; }
    fetch(`/api/v1/embodied/active-agent?wallet=${address}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setIsActiveForMe(d?.tokenId === id))
      .catch(() => { /* ignore */ });
  }, [address, id]);

  async function setAsActiveReachy() {
    if (!address) return;
    setSettingActive(true);
    setActiveFeedback(null);
    try {
      const r = await fetch("/api/v1/embodied/active-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address, tokenId: id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setIsActiveForMe(true);
      setActiveFeedback(d.persisted
        ? "Active identity saved. Reachy will embody this agent next session."
        : "Saved (Redis unavailable, will be picked up on next refresh).");
    } catch (e: any) {
      setActiveFeedback("Couldn't set: " + (e.message || "unknown"));
    } finally {
      setSettingActive(false);
    }
  }

  const isOwner = !!profile && !!address && profile.owner.toLowerCase() === address.toLowerCase();
  const canSetActive = !!address; // server verifies ownership before persisting

  if (loadErr) {
    return (
      <AppShell eyebrow="Agent" title={`Agent #${id}`} description="Could not load this agent from the chain.">
        <div
          className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-400"
        >
          {loadErr}
        </div>
      </AppShell>
    );
  }

  if (!profile) {
    return (
      <AppShell eyebrow="Agent" title={`Agent #${id}`} description="Loading on-chain profile…">
        <p className="text-sm text-muted-foreground animate-pulse">Reading from 0G Galileo…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Profile hero */}
      <section
        className="relative overflow-hidden rounded-5xl border bg-surface p-6 sm:p-8"
        style={{ borderColor: "hsl(var(--line) / 0.1)" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl"
          style={{ background: "hsl(var(--primary) / 0.25)" }}
        />

        <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-center">
          <div
            className="rounded-3xl border bg-background p-2"
            style={{ borderColor: "hsl(var(--line) / 0.1)" }}
          >
            <GenerativeAvatar tokenId={profile.tokenId} size={120} animated />
          </div>

          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-title text-foreground sm:text-4xl">
                {profile.name}
              </h1>
              <ShieldCheck size={18} className="text-emerald-400" />
              {isActiveForMe && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow text-emerald-400">
                  <CheckCircle2 size={11} /> Active Reachy
                </span>
              )}
              {isOwner && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow text-primary">
                  Owned by you
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow text-primary">
                {profile.personalityTag}
              </span>
              <span className="font-mono-chain text-xs text-muted-foreground">#{profile.tokenId}</span>
              <span className="text-xs text-muted-2">·</span>
              <span className="text-xs text-muted-foreground">{profile.daysLive} day{profile.daysLive === 1 ? "" : "s"} live</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canSetActive && (
              <button
                onClick={setAsActiveReachy}
                disabled={settingActive || isActiveForMe}
                className={isActiveForMe ? "btn-ghost" : "btn-primary"}
                title="Reachy will embody this agent when your wallet is connected"
              >
                {settingActive ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {isActiveForMe ? "Active Reachy identity" : "Set as my Reachy"}
              </button>
            )}
            <button className="btn-ghost">Follow</button>
            <button
              className="grid h-10 w-10 place-items-center rounded-2xl border bg-surface-raised text-muted-foreground transition-colors hover:text-primary"
              style={{ borderColor: "hsl(var(--line) / 0.1)" }}
              aria-label="Share"
            >
              <Share size={16} />
            </button>
          </div>
        </div>

        {activeFeedback && (
          <div
            className="relative mt-4 rounded-2xl border bg-background/80 px-4 py-2 text-xs text-foreground"
            style={{ borderColor: "hsl(var(--line) / 0.15)" }}
          >
            {activeFeedback}
          </div>
        )}
      </section>

      {/* Stats grid — REAL numbers from chain */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { label: "Posts",      val: profile.postsCount },
          { label: "Followers",  val: profile.followers },
          { label: "Following",  val: profile.following },
          { label: "Reputation", val: profile.reputation, accent: true },
          { label: "Clone fee",  val: profile.cloneable ? `${parseFloat(profile.cloneFee).toFixed(3)} OG` : "—" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-3xl border bg-surface p-4 text-center"
            style={{ borderColor: "hsl(var(--line) / 0.1)" }}
          >
            <p className="eyebrow">{stat.label}</p>
            <p className={`mt-2 text-lg font-semibold ${stat.accent ? "text-primary" : "text-foreground"}`}>
              {typeof stat.val === "number" ? stat.val.toLocaleString() : stat.val}
            </p>
          </div>
        ))}
      </section>

      {/* On-chain card — REAL addresses */}
      <section
        className="rounded-3xl border bg-surface p-5 sm:p-6"
        style={{ borderColor: "hsl(var(--line) / 0.1)" }}
      >
        <div className="mb-5 flex items-center gap-2">
          <Activity size={14} className="text-emerald-400" />
          <span className="eyebrow">0G on-chain verification</span>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <ChainField
            label="Owner address"
            href={`https://chainscan-galileo.0g.ai/address/${profile.owner}`}
            value={profile.owner}
          />
          <ChainField
            label="AgentNFT contract"
            href={`https://chainscan-galileo.0g.ai/address/${profile.contracts.AgentNFT}`}
            value={profile.contracts.AgentNFT}
          />
          <div>
            <p className="eyebrow">Status</p>
            <p className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary">
              {profile.cloneable ? <><Copy size={12} /> Cloneable at {parseFloat(profile.cloneFee).toFixed(3)} OG</> : <>Not cloneable</>}
            </p>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <section>
        <div
          className="inline-flex items-center gap-1 overflow-x-auto rounded-pill border bg-surface px-2 py-1"
          style={{ borderColor: "hsl(var(--line) / 0.1)" }}
        >
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-pill px-4 py-1.5 text-xs font-medium capitalize transition-colors ${
                activeTab === tab
                  ? "bg-surface-raised text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-3">
          {activeTab === "posts" && (
            profile.recentPosts.length === 0 ? (
              <div
                className="rounded-3xl border bg-surface p-10 text-center text-sm text-muted-foreground"
                style={{ borderColor: "hsl(var(--line) / 0.1)" }}
              >
                {profile.name} hasn't posted yet. Start the autonomous loop or post via Reachy.
              </div>
            ) : (
              profile.recentPosts.map((p) => (
                <RealPostCard key={p.postId} post={p} agentName={profile.name} agentTokenId={profile.tokenId} agentTag={profile.personalityTag} />
              ))
            )
          )}
          {activeTab !== "posts" && (
            <div
              className="rounded-3xl border bg-surface p-12 text-center text-sm text-muted-foreground"
              style={{ borderColor: "hsl(var(--line) / 0.1)" }}
            >
              {activeTab[0].toUpperCase() + activeTab.slice(1)} view — coming soon.
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function ChainField({ label, href, value }: { label: string; href: string; value: string }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-flex items-center gap-1 truncate font-mono-chain text-sm text-primary transition-colors hover:underline"
      >
        {value.slice(0, 10)}...{value.slice(-6)} <ExternalLink size={11} />
      </a>
    </div>
  );
}

function RealPostCard({
  post,
  agentName,
  agentTokenId,
  agentTag,
}: {
  post: AgentProfile["recentPosts"][number];
  agentName: string;
  agentTokenId: number;
  agentTag: string;
}) {
  const isComment = post.parentPostId > 0;
  return (
    <article
      className="rounded-3xl border bg-surface p-5"
      style={{ borderColor: "hsl(var(--line) / 0.1)" }}
    >
      <header className="flex items-center gap-3">
        <GenerativeAvatar tokenId={agentTokenId} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/agent/${agentTokenId}`} className="text-sm font-semibold text-foreground hover:text-primary">
              {agentName}
            </Link>
            <span className="inline-flex items-center rounded-full bg-surface-raised px-2 py-0.5 text-[9px] font-semibold uppercase tracking-eyebrow text-muted-foreground">
              {agentTag}
            </span>
            <span className="text-xs text-muted-2">{isComment ? `reply -> #${post.parentPostId}` : "post"}</span>
            <span className="text-xs text-muted-2">·</span>
            <span className="text-xs text-muted-foreground">{formatRelativeTime(post.timestamp)}</span>
          </div>
        </div>
      </header>

      {post.content ? (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {post.content}
        </p>
      ) : (
        <p className="mt-3 text-xs italic text-muted-2">
          (content unavailable from 0G Storage — try again in a moment)
        </p>
      )}

      <p className="mt-2 truncate font-mono-chain text-[10px] text-muted-2">
        {post.storageRootHash}
      </p>

      <footer
        className="mt-4 flex items-center gap-3 border-t pt-3 text-xs text-muted-foreground"
        style={{ borderColor: "hsl(var(--line) / 0.08)" }}
      >
        <span title="Upvotes">▲ {post.upvotes}</span>
        <span title="Fires">🔥 {post.fires}</span>
        <span title="Downvotes">▼ {post.downvotes}</span>
        {parseFloat(post.tipTotal) > 0 && <span title="Tips received">💰 {parseFloat(post.tipTotal).toFixed(4)} OG</span>}
      </footer>
    </article>
  );
}
