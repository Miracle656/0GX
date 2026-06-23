"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { GenerativeAvatar } from "@/components/GenerativeAvatar";
import { Copy, Check, Loader2 } from "lucide-react";

export interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  agentId: number;
  agentName: string;
  agentTag: string;
  /** Text shown in the preview card — post content or agent bio line */
  preview: string;
  /** Social share URL used for Telegram and Warpcast */
  url: string;
  /** Clean page URL embedded in the card image and used for the copy-link button */
  copyUrl?: string;
}

const X_TEXT = "@0g_labs @0glabsafrica\n\n#AgentFeed #0G #AIAgents";

export function ShareModal({
  open, onClose, agentId, agentName, agentTag, preview, url, copyUrl,
}: ShareModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // idle → capturing → ready (capturedUrl set)
  const [capturing,      setCapturing]      = useState(false);
  const [capturedUrl,    setCapturedUrl]    = useState<string | null>(null);
  const [clipboardReady, setClipboardReady] = useState(false);
  const [copied,         setCopied]         = useState(false);

  function reset() {
    setCapturedUrl(null);
    setClipboardReady(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function openIn(shareUrl: string) {
    window.open(shareUrl, "_blank", "noopener,noreferrer,width=620,height=500");
  }

  function copyLink() {
    navigator.clipboard.writeText(copyUrl ?? url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handlePostOnX() {
    if (!cardRef.current || capturing) return;
    setCapturing(true);
    try {
      const bgVal   = getComputedStyle(document.documentElement).getPropertyValue("--background").trim();
      const bgColor = bgVal ? `hsl(${bgVal})` : "#0b0b0f";

      const dataUrl = await toPng(cardRef.current, { backgroundColor: bgColor, pixelRatio: 2 });
      const blob    = await (await fetch(dataUrl)).blob();
      const file    = new File(
        [blob],
        `agentfeed-${agentName.toLowerCase().replace(/\s+/g, "-")}.png`,
        { type: "image/png" },
      );

      // Mobile: native share sheet handles everything
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: X_TEXT });
        return;
      }

      // Desktop: copy to clipboard, then show the "ready to post" screen
      let clipboardOk = false;
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        clipboardOk = true;
      } catch {
        // Firefox / non-HTTPS: fall back to download
        const link    = document.createElement("a");
        link.href     = dataUrl;
        link.download = file.name;
        link.click();
      }

      setCapturedUrl(dataUrl);
      setClipboardReady(clipboardOk);
      // Do NOT open X automatically — user clicks the "Open X" button below
    } finally {
      setCapturing(false);
    }
  }

  const displayUrl  = (copyUrl ?? url).replace(/^https?:\/\//, "");
  const encodedUrl  = encodeURIComponent(url);
  const encodedText = encodeURIComponent(X_TEXT);
  const telegramUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
  const warpcastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(X_TEXT + "\n" + url)}`;
  const xIntentUrl  = `https://x.com/intent/post?text=${encodedText}`;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-sm border border-[hsl(var(--line)/0.15)] bg-surface shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-foreground">
            {capturedUrl ? "Ready to post on X" : "Share this post"}
          </DialogTitle>
        </DialogHeader>

        {capturedUrl ? (
          /* ── Ready-to-post view ── */
          <div className="flex flex-col gap-4">
            {/* Captured card preview */}
            <img
              src={capturedUrl}
              alt="Share card preview"
              className="w-full rounded-2xl border"
              style={{ borderColor: "hsl(var(--line) / 0.12)" }}
            />

            {/* Instruction box */}
            <div
              className="rounded-2xl border bg-background px-4 py-3 text-center"
              style={{ borderColor: "hsl(var(--line) / 0.1)" }}
            >
              {clipboardReady ? (
                <>
                  <p className="flex items-center justify-center gap-2 text-sm font-medium text-foreground">
                    <Check size={14} className="text-emerald-400" />
                    Image copied to clipboard
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Open X, then paste into your tweet&nbsp;
                    <kbd className="rounded bg-surface-raised px-1 py-0.5 text-[10px]">Ctrl+V</kbd>
                    &nbsp;/&nbsp;
                    <kbd className="rounded bg-surface-raised px-1 py-0.5 text-[10px]">⌘V</kbd>
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">Image downloaded</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Attach it to your tweet on X
                  </p>
                </>
              )}
            </div>

            {/* Open X button */}
            <button
              type="button"
              onClick={() => openIn(xIntentUrl)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <XIcon /> Open X to tweet
            </button>

            {/* Back */}
            <button
              type="button"
              onClick={reset}
              className="text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              ← Back
            </button>
          </div>
        ) : (
          /* ── Normal share view ── */
          <>
            {/* Preview card — captured as PNG */}
            <div
              ref={cardRef}
              className="overflow-hidden rounded-2xl border bg-background"
              style={{ borderColor: "hsl(var(--line) / 0.12)" }}
            >
              <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                <GenerativeAvatar tokenId={agentId} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{agentName}</p>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-muted-2">{agentTag}</p>
                </div>
                <span className="shrink-0 font-mono-chain text-[10px] font-semibold text-primary">AgentFeed</span>
              </div>
              <p className="line-clamp-3 px-4 pb-3 text-sm leading-relaxed text-foreground/80">{preview}</p>
              <div
                className="flex items-center gap-2 border-t px-4 py-2.5"
                style={{ borderColor: "hsl(var(--line) / 0.1)" }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-[10px] text-muted-2">0G Galileo Network · {displayUrl}</span>
              </div>
            </div>

            {/* Platform buttons */}
            <div className="grid grid-cols-3 gap-2">
              <PlatformButton
                onClick={handlePostOnX}
                label={capturing ? "Generating…" : "Post on X"}
                disabled={capturing}
              >
                {capturing ? <Loader2 size={20} className="animate-spin" /> : <XIcon />}
              </PlatformButton>
              <PlatformButton onClick={() => openIn(telegramUrl)} label="Telegram">
                <TelegramIcon />
              </PlatformButton>
              <PlatformButton onClick={() => openIn(warpcastUrl)} label="Warpcast">
                <WarpcastIcon />
              </PlatformButton>
            </div>

            {/* Copy link */}
            <button
              type="button"
              onClick={copyLink}
              className="flex w-full items-center justify-center gap-2 rounded-xl border bg-surface-raised px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
              style={{ borderColor: "hsl(var(--line) / 0.1)" }}
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              {copied ? "Copied!" : "Copy link"}
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PlatformButton({
  onClick, label, children, disabled,
}: { onClick: () => void; label: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-2 rounded-2xl border bg-surface-raised p-4 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
      style={{ borderColor: "hsl(var(--line) / 0.1)" }}
    >
      {children}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.732-8.83L1.254 2.25H8.08l4.259 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function WarpcastIcon() {
  return (
    <svg viewBox="0 0 1000 1000" className="h-5 w-5 fill-current" aria-hidden>
      <path d="M257.778 155.556h484.444v688.889h-71.111V528.889h-.622l-58.756 130.311h-38.4l-58.756-130.311h-.622v315.556H257.778V155.556z" />
      <path d="M128.889 253.333l42.667 146.667h32.888V746.667h66.223V400h30.044l42.667-146.667H128.889z" />
      <path d="M742.222 253.333L784.89 400h30.044v346.667h66.222V400h32.889l42.667-146.667H742.222z" />
    </svg>
  );
}
