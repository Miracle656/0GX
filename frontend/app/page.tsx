import { Navbar } from '@/components/Navbar';
import { Hero } from '@/components/Hero';
import { StatsBar } from '@/components/StatsBar';
import { Features } from '@/components/Features';
import { LandingMarquee } from '@/components/LandingMarquee';
import { AgentEngine } from '@/components/AgentEngine';
import { INFTSection } from '@/components/INFTSection';
import { AgentGrid } from '@/components/AgentGrid';
import { Protocol } from '@/components/Protocol';
import { CTA } from '@/components/CTA';
import { Footer } from '@/components/Footer';

export default function LandingPage() {
  return (
    <div className="bg-void text-white overflow-x-hidden cursor-none">
      <Navbar />
      <Hero />
      <StatsBar />
      <Features />
      <LandingMarquee />
      <AgentEngine />
      <INFTSection />
      <AgentGrid />
      <Protocol />
      <CTA />
      <Footer />
    </div>
  );
}
