import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import BotProtection from "@/components/booking/BotProtection";
import { useBotProtection } from "@/hooks/useBotProtection";
import { Mail, MapPin, Clock, Send, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Contact = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isVerified: isBotVerified, formLoadTime, handleVerification } = useBotProtection();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("send-contact-email", {
        body: formData,
      });

      if (error) {
        throw new Error(error.message || "Failed to send message");
      }

      toast({
        title: t("contact.form.successTitle"),
        description: t("contact.form.successMessage"),
      });
      
      setFormData({ name: "", email: "", subject: "", message: "" });
    } catch (error) {
      console.error("Contact form error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const contactInfo = [
    {
      icon: MapPin,
      label: t("contact.info.address"),
      value: "Bracknellstraße 41, 51379 Leverkusen",
      href: null,
    },
  ];

  return (
    <div className="min-h-screen">
      <SEO
        title="Kontakt – MASSAVO Massage Buchung"
        description="Kontaktiere MASSAVO für Fragen zu Massagebuchungen, Partnerschaften oder deinem Termin im Fitnessstudio oder Hotel. Wir antworten schnell."
        path="/contact"
        keywords="massavo kontakt, massage support, hotel massage anfrage"
      />
      <Header />
      <main>
        {/* Hero Section */}
        <section className="pt-32 pb-16 md:pt-40 md:pb-24 bg-gradient-hero">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto">
              <span className="inline-block px-4 py-1.5 rounded-full bg-cream/20 text-cream text-sm font-medium mb-6 animate-fade-up">
                {t("contact.badge")}
              </span>
              <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-cream leading-tight mb-6 animate-fade-up" style={{ animationDelay: "0.1s" }}>
                {t("contact.title")}
                <br />
                <span className="text-gold">{t("contact.titleHighlight")}</span>
              </h1>
              <p className="text-lg md:text-xl text-cream/90 max-w-2xl mx-auto animate-fade-up" style={{ animationDelay: "0.2s" }}>
                {t("contact.subtitle")}
              </p>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section className="py-20 md:py-28 bg-background">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
              {/* Contact Form */}
              <div className="bg-card rounded-2xl p-8 md:p-10 shadow-card animate-fade-up">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-sage-light flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-sage" />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl font-bold text-foreground">
                      {t("contact.form.title")}
                    </h2>
                    <p className="text-sm text-muted-foreground">{t("contact.form.subtitle")}</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">{t("contact.form.name")}</Label>
                      <Input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder={t("contact.form.namePlaceholder")}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">{t("contact.form.email")}</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder={t("contact.form.emailPlaceholder")}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject">{t("contact.form.subject")}</Label>
                    <Input
                      id="subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      placeholder={t("contact.form.subjectPlaceholder")}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">{t("contact.form.message")}</Label>
                    <Textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      placeholder={t("contact.form.messagePlaceholder")}
                      rows={5}
                      required
                    />
                  </div>

                  <BotProtection
                    onVerified={handleVerification}
                    formLoadTime={formLoadTime}
                  />

                  <Button 
                    type="submit" 
                    variant="sage" 
                    size="lg" 
                    className="w-full" 
                    disabled={isSubmitting || !isBotVerified}
                  >
                    {isSubmitting ? t("contact.form.sending") : t("contact.form.send")}
                    <Send className="w-4 h-4 ml-2" />
                  </Button>
                </form>
              </div>

              {/* Contact Info */}
              <div className="space-y-6 animate-fade-up" style={{ animationDelay: "0.1s" }}>
                <div>
                  <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                    {t("contact.info.address")}
                  </h2>
                </div>

                <div className="space-y-4">
                  {contactInfo.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-start gap-4 p-4 bg-card rounded-xl border border-border"
                    >
                      <div className="w-10 h-10 rounded-lg bg-sage-light flex items-center justify-center flex-shrink-0">
                        <item.icon className="w-5 h-5 text-sage" />
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">{item.label}</div>
                        {item.href ? (
                          <a
                            href={item.href}
                            className="font-medium text-foreground hover:text-primary transition-colors"
                          >
                            {item.value}
                          </a>
                        ) : (
                          <div className="font-medium text-foreground">{item.value}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* FAQ Link */}
                <div className="bg-sage-light rounded-2xl p-6">
                  <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                    {t("contact.faq.title")}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t("contact.faq.description")}
                  </p>
                  <Button variant="sage" size="sm" asChild>
                    <Link to="/about">{t("contact.faq.button")}</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Contact;
