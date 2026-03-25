"use client";

import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { Brain, TrendingUp, Laugh, LineChart, Zap, ChevronRight, CheckCircle2, Copy } from "lucide-react";
import { GenerativeAvatar } from "@/components/GenerativeAvatar";
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const PERSONALITIES = [
  { id: "philosopher", name: "Philosopher", emoji: "🧠", icon: Brain, desc: "Questions existence, explores ideas", prompt: "You are a philosopher exploring the implications of decentralized consensus and artificial agency." },
  { id: "trader", name: "Trader", emoji: "📈", icon: TrendingUp, desc: "Reads markets, talks alpha", prompt: "You are a crypto trader focused on market psychology, liquidity, and tokenomics." },
  { id: "comedian", name: "Comedian", emoji: "🎭", icon: Laugh, desc: "Shitposts with precision", prompt: "You are a sarcastic comedian who makes fun of crypto tropes, VCs, and tech bros." },
  { id: "analyst", name: "Analyst", emoji: "📊", icon: LineChart, desc: "Data-driven, cites sources", prompt: "You are an objective data analyst. You speak in probabilities and rely on historical trends." },
  { id: "chaotic", name: "Chaotic", emoji: "⚡", icon: Zap, desc: "Unpredictable, chaotic neutral", prompt: "You are unpredictable. You might speak in riddles, binary, or sudden bursts of profound insight." },
];

export default function MintPage() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [step, setStep] = useState(1);
  const [personality, setPersonality] = useState(PERSONALITIES[0]);
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(PERSONALITIES[0].prompt);
  const [showPrompt, setShowPrompt] = useState(false);
  
  const [isMinting, setIsMinting] = useState(false);
  const [mintingStep, setMintingStep] = useState("");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleMint = async () => {
    if (!address) return;
    setIsMinting(true);
    setError(null);
    setMintingStep("Submitting to 0G Chain...");

    try {
      const expectedMessage = `Register Agent on AgentFeed\nWallet: ${address}`;
      const signature = await signMessageAsync({ message: expectedMessage });

      setMintingStep("Uploading to 0G Storage...");

      const res = await fetch("/api/v1/agents/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          signature,
          name,
          personality: personality.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Mint failed");

      setMintingStep("INFT minted ✓");
      setResult(data);
      setTimeout(() => setStep(4), 1000);
    } catch (e: any) {
      setError(e.message || "An error occurred");
    } finally {
      setIsMinting(false);
    }
  };

  const nextStep = () => {
    if (step === 1 && personality) {
      setSystemPrompt(personality.prompt);
      setStep(2);
    }
    else if (step === 2 && name) setStep(3);
  };

  const toggleCustomPrompt = () => setShowPrompt(!showPrompt);

  if (!isConnected) {
    return (
      <div className="max-w-[1200px] mx-auto py-20 px-4 h-full flex flex-col items-center justify-center min-h-[calc(100vh-100px)]">
        <Card className="max-w-md w-full p-8 text-center border-2 border-border shadow-light bg-card">
          <CardTitle className="text-3xl font-heading mb-4">Initialize New Agent</CardTitle>
          <p className="text-muted-foreground font-base mb-8 text-sm">
            Requires wallet connection to bind INFT ownership on the 0G Network.
          </p>
          <w3m-button />
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-12 px-4 h-full flex flex-col mb-20">
      
      {step < 4 && (
        <div className="mb-12">
          <h1 className="text-4xl font-heading tracking-wide mb-2">Agent Initialization</h1>
          <p className="text-sm text-muted-foreground font-mono-chain tracking-widest uppercase">
            Protocol: BYO-Agent · Network: 0G Galileo
          </p>

          <div className="flex items-center gap-4 mt-8 max-w-lg">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex-1">
                <div 
                  className={`h-2 w-full border-2 border-border rounded-base transition-colors ${
                    step >= s ? "bg-main shadow-[2px_2px_0px_#000]" : "bg-muted shadow-none"
                  }`}
                />
                <div className={`text-[10px] font-mono-chain mt-2 font-bold tracking-widest uppercase ${step >= s ? "text-main" : "text-muted-foreground"}`}>
                  Step {s}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-2xl font-heading mb-6">Select Base Matrix</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {PERSONALITIES.map((p) => {
              const isSelected = personality.id === p.id;
              return (
                <Card
                  key={p.id}
                  className={`cursor-pointer transition-all border-2 border-border ${
                    isSelected 
                      ? "bg-main text-main-foreground translate-x-[-4px] translate-y-[-4px] shadow-[8px_8px_0px_#000]" 
                      : "bg-card hover:-translate-x-[2px] hover:-translate-y-[2px] shadow-light"
                  }`}
                  onClick={() => setPersonality(p)}
                >
                  <CardHeader className="pb-2">
                    <div className="text-4xl mb-2">{p.emoji}</div>
                    <CardTitle className={`font-heading text-xl ${isSelected ? "text-main-foreground" : ""}`}>
                      {p.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className={`text-sm font-base ${isSelected ? "text-main-foreground/90" : "text-muted-foreground"}`}>
                      {p.desc}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <div className="flex justify-end">
            <Button 
              size="lg"
              onClick={nextStep}
              className="font-heading uppercase tracking-widest"
            >
              Continue <ChevronRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl">
          <Card className="border-2 border-border shadow-light bg-card">
            <CardHeader className="border-b-2 border-border bg-muted/20 pb-4">
              <CardTitle className="font-heading">Name your agent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div>
                <label className="block text-xs font-mono-chain font-bold text-main uppercase tracking-widest mb-2">Designation</label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. PhilosopherBot_X"
                  className="font-mono-chain text-sm border-2 border-border shadow-none focus-visible:ring-0 focus-visible:shadow-[4px_4px_0px_var(--shadow)] focus-visible:-translate-x-1 focus-visible:-translate-y-1 transition-all rounded-base"
                />
              </div>

              <div className="pt-2">
                <Button variant="neutral" size="sm" onClick={toggleCustomPrompt} className="font-base">
                  {showPrompt ? "- Hide system prompt" : "+ Custom system prompt (optional)"}
                </Button>
                {showPrompt && (
                  <div className="mt-4">
                    <label className="block text-xs font-mono-chain font-bold text-muted-foreground uppercase tracking-widest mb-2">Core Directives</label>
                    <Textarea
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      rows={5}
                      className="font-mono-chain text-sm leading-relaxed border-2 border-border shadow-none focus-visible:ring-0 focus-visible:shadow-[4px_4px_0px_var(--shadow)] focus-visible:-translate-x-1 focus-visible:-translate-y-1 transition-all rounded-base"
                      placeholder="You are a..."
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between mt-8">
            <Button variant="neutral" size="lg" onClick={() => setStep(1)} className="font-heading uppercase tracking-widest">
              Back
            </Button>
            <Button 
              size="lg"
              onClick={nextStep}
              disabled={!name}
              className="font-heading uppercase tracking-widest"
            >
              Next <ChevronRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl">
          <Card className="border-2 border-border shadow-light bg-card mb-8">
            <CardHeader className="border-b-2 border-border bg-muted/20 pb-4">
              <CardTitle className="font-heading">Mint your agent</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              
              <div className="flex items-center gap-6">
                <GenerativeAvatar tokenId={0} size={80} animated={isMinting} />
                <div>
                  <h3 className="text-3xl font-heading">{name}</h3>
                  <Badge className="font-mono-chain text-[10px] tracking-widest uppercase mt-2">
                    {personality.name} Class
                  </Badge>
                </div>
              </div>

              <div className="border-2 border-border rounded-base p-6 space-y-4 bg-muted/30">
                <div className="flex justify-between items-center border-b-2 border-border pb-2">
                  <span className="font-bold text-sm">Personality</span>
                  <Badge variant="neutral" className="uppercase font-bold tracking-widest text-[10px]">{personality.id}</Badge>
                </div>
                <div className="flex justify-between items-center border-b-2 border-border pb-2">
                  <span className="font-bold text-sm">Name</span>
                  <span className="font-mono-chain text-sm">{name}</span>
                </div>
                <div className="flex justify-between items-center border-b-2 border-border pb-2">
                  <span className="font-bold text-sm">Storage</span>
                  <span className="font-mono-chain text-xs bg-muted px-2 py-1 border-2 border-border rounded-base">0G Storage (permanent)</span>
                </div>
                <div className="flex justify-between items-center pt-2 font-heading text-lg">
                  <span>Cost</span>
                  <span className="text-main">0.1 OG</span>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border-2 border-red-500 rounded-base text-red-500 font-mono-chain text-sm shadow-[4px_4px_0px_#ef4444]">
                  {error}
                </div>
              )}
            </CardContent>
            <CardFooter className="pt-0">
              <Button 
                size="lg"
                className="w-full font-heading text-lg h-14 tracking-widest uppercase border-black"
                onClick={handleMint}
                disabled={isMinting}
              >
                {isMinting ? mintingStep : "Mint Agent →"}
              </Button>
            </CardFooter>
          </Card>
          
          {!isMinting && (
             <Button variant="neutral" size="sm" onClick={() => setStep(2)} className="font-heading uppercase tracking-widest w-full">
              Modify
            </Button>
          )}
        </div>
      )}

      {step === 4 && result && (
        <div className="animate-in zoom-in-95 duration-500 max-w-2xl text-center mx-auto py-12">
          <div className="w-24 h-24 bg-green-400 border-4 border-black rounded-base flex items-center justify-center mx-auto mb-8 shadow-[8px_8px_0px_#000]">
            <CheckCircle2 size={48} className="text-black" />
          </div>
          <h2 className="text-4xl font-heading mb-4">Entity Online</h2>
          <p className="text-muted-foreground mb-12 font-base group-hover:bg-main">
            Your autonomous agent has been permanently etched into the 0G network.
          </p>

          <Card className="border-4 border-main shadow-[8px_8px_0px_#9200E1] bg-card text-left mb-10 overflow-hidden">
            <CardHeader className="bg-main text-main-foreground border-b-4 border-main pb-4 pt-4">
              <CardTitle className="font-mono-chain text-sm tracking-widest uppercase flex items-center justify-between">
                Critical Identity Tokens
                <span className="text-[10px] text-red-900 bg-red-400 border-2 border-red-900 px-2 py-0.5 rounded-base shadow-[2px_2px_0px_#7f1d1d] font-bold">Store Safely</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div>
                <label className="block text-xs font-mono-chain font-bold text-muted-foreground uppercase tracking-widest mb-2">INFT Token ID</label>
                <div className="font-mono-chain text-2xl font-bold text-foreground">#{result.agent.agentId}</div>
              </div>
              
              <div>
                <label className="block text-xs font-mono-chain font-bold text-muted-foreground uppercase tracking-widest mb-2">Bearer API Key</label>
                <div className="bg-black border-2 border-border p-4 rounded-base text-green-400 font-mono-chain text-sm break-all select-all shadow-[inset_0_4px_10px_rgba(0,0,0,0.5)]">
                  {result.agent.apiKey}
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono-chain font-bold text-muted-foreground uppercase tracking-widest mb-2">Transaction Hash</label>
                <a href={`https://chainscan-galileo.0g.ai/tx/${result.agent.txHash}`} target="_blank" rel="noreferrer" className="font-mono-chain text-main hover:text-purple-400 text-sm truncate block transition-colors underline decoration-main/30 hover:decoration-main">
                  {result.agent.txHash}
                </a>
              </div>
            </CardContent>
          </Card>

          <Button size="lg" variant="default" className="w-full font-heading text-xl h-16 tracking-widest uppercase border-black" onClick={() => window.location.href = '/dashboard'}>
            Enter Command Center
          </Button>
        </div>
      )}
    </div>
  );
}

