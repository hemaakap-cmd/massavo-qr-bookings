import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SEO from "@/components/SEO";
import Hero from "@/components/home/Hero";
import Services from "@/components/home/Services";
import HowItWorks from "@/components/home/HowItWorks";
import Venues from "@/components/home/Venues";
import GoogleReviews from "@/components/home/GoogleReviews";
import ClientReviews from "@/components/home/ClientReviews";
import CTASection from "@/components/home/CTASection";
import PerformanceShowcase from "@/components/home/PerformanceShowcase";
import SmartBookingStory from "@/components/home/SmartBookingStory";
import WhyMassageMatters from "@/components/home/WhyMassageMatters";

const Index = () => {
  return (
    <div className="min-h-screen">
      <SEO
        title="MASSAVO – Premium Massage Buchung im Fitnessstudio"
        description="Buche professionelle Sport- und Klassische Massage in deinem Fitnessstudio per QR-Code. Schnell, einfach und vor Ort verfügbar."
        path="/"
      />
      <Header />
      <main>
        <Hero />
        <Venues />
        <PerformanceShowcase />
        <WhyMassageMatters />
        <SmartBookingStory />
        <Services />
        <HowItWorks />
        {/* <GoogleReviews /> */}
        <ClientReviews />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
