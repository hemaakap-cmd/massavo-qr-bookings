import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Award, Users, Zap, Heart, Star, ArrowRight, MapPin, Hotel } from "lucide-react";

const About = () => {
  const { t } = useTranslation();

  const values = [
    {
      icon: Award,
      title: t("about.values.excellence.title"),
      description: t("about.values.excellence.description"),
    },
    {
      icon: Users,
      title: t("about.values.accessibility.title"),
      description: t("about.values.accessibility.description"),
    },
    {
      icon: Zap,
      title: t("about.values.innovation.title"),
      description: t("about.values.innovation.description"),
    },
    {
      icon: Heart,
      title: t("about.values.community.title"),
      description: t("about.values.community.description"),
    },
  ];

  return (
    <div className="min-h-screen">
      <SEO
        title="Über uns – MASSAVO Massage im Fitnessstudio"
        description="Erfahre mehr über MASSAVO: professionelle Massagetherapie direkt in deinem Fitnessstudio – schnell, einfach und in deiner Stadt."
        path="/about"
      />
      <Header />
      <main>
        {/* Hero Section */}
        <section className="pt-32 pb-16 md:pt-40 md:pb-24 bg-gradient-hero">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto">
              <span className="inline-block px-4 py-1.5 rounded-full bg-cream/20 text-cream text-sm font-medium mb-6 animate-fade-up">
                {t("about.badge")}
              </span>
              <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-cream leading-tight mb-6 animate-fade-up" style={{ animationDelay: "0.1s" }}>
                {t("about.title")}
                <br />
                <span className="text-gold">{t("about.titleHighlight")}</span>
              </h1>
              <p className="text-lg md:text-xl text-cream/90 max-w-2xl mx-auto animate-fade-up" style={{ animationDelay: "0.2s" }}>
                {t("about.subtitle")}
              </p>
            </div>
          </div>
        </section>

        {/* Story Section */}
        <section className="py-20 md:py-28 bg-background">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-8 text-center">
                {t("about.story.title")}
              </h2>
              <div className="space-y-6 text-lg text-muted-foreground leading-relaxed">
                <p className="animate-fade-up">{t("about.story.p1")}</p>
                <p className="animate-fade-up" style={{ animationDelay: "0.1s" }}>{t("about.story.p2")}</p>
                <p className="animate-fade-up" style={{ animationDelay: "0.2s" }}>{t("about.story.p3")}</p>
              </div>
            </div>
          </div>
        </section>


        {/* Mission & Vision */}
        <section className="py-20 md:py-28 bg-background">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
              <div className="bg-card rounded-2xl p-8 md:p-10 shadow-card animate-fade-up">
                <div className="w-14 h-14 rounded-xl bg-sage-light flex items-center justify-center mb-6">
                  <Zap className="w-7 h-7 text-sage" />
                </div>
                <h3 className="font-display text-2xl font-bold text-foreground mb-4">
                  {t("about.mission.title")}
                </h3>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  {t("about.mission.description")}
                </p>
              </div>
              <div className="bg-card rounded-2xl p-8 md:p-10 shadow-card animate-fade-up" style={{ animationDelay: "0.1s" }}>
                <div className="w-14 h-14 rounded-xl bg-gold-light flex items-center justify-center mb-6">
                  <Star className="w-7 h-7 text-gold" />
                </div>
                <h3 className="font-display text-2xl font-bold text-foreground mb-4">
                  {t("about.vision.title")}
                </h3>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  {t("about.vision.description")}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="py-20 md:py-28 bg-sage-light">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
                {t("about.values.title")}
              </h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {values.map((value, index) => (
                <div
                  key={value.title}
                  className="bg-card rounded-2xl p-6 shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 animate-fade-up"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="w-12 h-12 rounded-xl bg-sage-light flex items-center justify-center mb-4">
                    <value.icon className="w-6 h-6 text-sage" />
                  </div>
                  <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                    {value.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {value.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 md:py-28 bg-gradient-hero">
          <div className="container mx-auto px-4 text-center">
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-cream mb-4">
              {t("about.cta.title")}
            </h2>
            <p className="text-cream/80 text-lg mb-8 max-w-xl mx-auto">
              {t("about.cta.subtitle")}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <Button asChild size="xl" variant="hero" className="group">
                <Link to="/cities">
                  <MapPin className="w-5 h-5" strokeWidth={2.4} />
                  <span>{t("about.cta.buttonGym")}</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1 rtl:rotate-180" />
                </Link>
              </Button>
              <Button asChild size="xl" variant="hero" className="group">
                <Link to="/hotels">
                  <Hotel className="w-5 h-5" strokeWidth={2.2} />
                  <span>{t("about.cta.buttonHotel")}</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1 rtl:rotate-180" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default About;
