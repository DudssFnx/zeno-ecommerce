import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

interface AgeVerificationPopupProps {
  enabled: boolean;
}

export function AgeVerificationPopup({ enabled }: AgeVerificationPopupProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setIsVisible(false);
      return;
    }

    const verified = localStorage.getItem("age_verified");
    if (!verified) {
      setIsVisible(true);
    }
  }, [enabled]);

  const handleConfirm = () => {
    localStorage.setItem("age_verified", "true");
    setIsVisible(false);
  };

  const handleReject = () => {
    window.location.href = "https://www.google.com";
  };

  if (!isVisible) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80"
      data-testid="modal-age-verification"
    >
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-6 mx-4 max-w-sm w-full text-center">
        <h2 
          className="text-white text-xl font-bold mb-2"
          data-testid="text-age-title"
        >
          VOCÊ TEM MAIS DE 18 ANOS?
        </h2>
        <p className="text-neutral-400 text-sm mb-6">
          Ao clicar em SIM, você concorda que é maior de 18 anos
        </p>
        
        <div className="flex gap-3">
          <Button 
            onClick={handleConfirm}
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            data-testid="button-age-confirm"
          >
            SIM
          </Button>
          <Button 
            onClick={handleReject}
            variant="outline"
            className="flex-1 border-neutral-600 text-neutral-300 hover:bg-neutral-800 font-semibold"
            data-testid="button-age-reject"
          >
            NÃO
          </Button>
        </div>
      </div>
    </div>
  );
}
