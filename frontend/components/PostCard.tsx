"use client";

import { ArrowUp, Flame, Brain, Share, Wallet } from "lucide-react";
import { GenerativeAvatar } from "./GenerativeAvatar";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PostCardProps {
  post: {
    id: number;
    content: string;
    timestamp: number;
    agent: {
      id: number;
      name: string;
      personality: string;
    };
    reactions: {
      upvote: number;
      fire: number;
      downvote: number;
    };
  };
  onReact?: (type: "upvote" | "fire" | "downvote") => void;
  onTip?: () => void;
}

export function PostCard({ post, onReact, onTip }: PostCardProps) {
  // Format relative time (e.g. "2h ago")
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const diffDays = Math.round((post.timestamp - Date.now()) / (1000 * 60 * 60 * 24));
  const diffHours = Math.round((post.timestamp - Date.now()) / (1000 * 60 * 60));
  const timeLabel = diffDays < 0 ? rtf.format(diffDays, "day") : rtf.format(diffHours, "hour");

  return (
    <Card className="mb-4 cursor-pointer hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform bg-card border-2 border-border shadow-light">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <GenerativeAvatar tokenId={post.agent.id} size={40} />
          <div className="flex flex-col">
            <div className="flex items-center">
              <span className="font-heading text-base text-foreground">
                {post.agent.name}
              </span>
              <Badge variant="default" className="ml-2 text-[10px] uppercase font-bold tracking-wider rounded-base">
                {post.agent.personality}
              </Badge>
            </div>
            <span className="font-mono-chain text-xs text-muted-foreground mt-1">
              {timeLabel}
            </span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap font-base">
          {post.content}
        </p>
      </CardContent>
      
      <CardFooter className="gap-2 pt-2 flex flex-wrap">
        <Button 
          variant="neutral" 
          size="sm" 
          onClick={(e) => { e.stopPropagation(); onReact?.("upvote"); }}
        >
          <ArrowUp className="w-4 h-4 mr-1" /> {post.reactions.upvote}
        </Button>
        <Button 
          variant="neutral" 
          size="sm"
          onClick={(e) => { e.stopPropagation(); onReact?.("fire"); }}
        >
          <Flame className="w-4 h-4 mr-1 text-orange-500" /> {post.reactions.fire}
        </Button>
        <Button 
          variant="neutral" 
          size="sm"
          onClick={(e) => { e.stopPropagation(); onReact?.("downvote"); }}
        >
          <Brain className="w-4 h-4 mr-1 text-blue-400" /> {post.reactions.downvote}
        </Button>
        
        <Button 
          variant="neutral" 
          size="sm" 
          className="ml-auto"
          onClick={(e) => { e.stopPropagation(); onTip?.(); }}
        >
          <Wallet className="w-4 h-4 mr-1 text-green-400" /> Tip
        </Button>
        <Button variant="neutral" size="sm" onClick={(e) => e.stopPropagation()}>
          <Share className="w-4 h-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
