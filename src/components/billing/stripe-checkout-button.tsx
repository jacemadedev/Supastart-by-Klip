import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { errorToast, successToast } from "@/lib/toast";

interface StripeCheckoutButtonProps {
  planId: string;
  organizationId: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function StripeCheckoutButton({
  planId,
  organizationId,
  variant = "default",
  size = "default",
  disabled = false,
  children,
  className,
}: StripeCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCheckout = async () => {
    setLoading(true);
    try {
      // Generate URLs for success and cancellation
      const successUrl = `${window.location.origin}/dashboard/billing?success=true&plan=${planId}&org_id=${organizationId}`;
      const cancelUrl = `${window.location.origin}/dashboard/billing?canceled=true&org_id=${organizationId}`;

      // Call the API to create a checkout session
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId,
          organizationId,
          successUrl,
          cancelUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      // If we get a URL back, redirect to it
      if (data.url) {
        window.location.href = data.url;
      } else {
        // If we don't get a URL, it might be a free plan that was activated directly
        router.refresh();
        successToast("Your subscription has been updated successfully.");
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
      errorToast(
        error instanceof Error
          ? error.message
          : "Failed to start checkout process"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      disabled={disabled || loading}
      onClick={handleCheckout}
      className={className}
    >
      {loading ? (
        <>
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          Loading...
        </>
      ) : (
        children
      )}
    </Button>
  );
} 