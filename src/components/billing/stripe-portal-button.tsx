import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LoaderCircle, ExternalLink } from "lucide-react";
import { errorToast } from "@/lib/toast";

interface StripePortalButtonProps {
  organizationId: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  disabled?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export function StripePortalButton({
  organizationId,
  variant = "outline",
  size = "default",
  disabled = false,
  children = "Manage Billing",
  className,
}: StripePortalButtonProps) {
  const [loading, setLoading] = useState(false);

  const handlePortalRedirect = async () => {
    setLoading(true);
    try {
      // Generate return URL
      const returnUrl = `${window.location.origin}/dashboard/billing`;

      // Call the API to create a portal session
      const response = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organizationId,
          returnUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create portal session");
      }

      // Redirect to the portal URL
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No URL returned from API");
      }
    } catch (error) {
      console.error("Error creating portal session:", error);
      errorToast(
        error instanceof Error
          ? error.message
          : "Failed to access billing portal"
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
      onClick={handlePortalRedirect}
      className={className}
    >
      {loading ? (
        <>
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          Loading...
        </>
      ) : (
        <>
          {children}
          <ExternalLink className="ml-2 h-4 w-4" />
        </>
      )}
    </Button>
  );
} 