"use client"

import { useOrganizationContext } from "@/contexts/organization-context"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { format } from "date-fns"

interface CreditManagerProps {
  credits: number;
  isActiveOrg: boolean;
  transactions?: {
    id: string;
    amount: number;
    description: string;
    createdAt: string;
    type: "add" | "use";
  }[];
  loading?: boolean;
}

export function CreditManager({
  credits = 0,
  isActiveOrg = true,
  transactions = [],
  loading = false,
}: CreditManagerProps) {
  const { 
    organization
  } = useOrganizationContext()
  
  // Function to format credit transaction date
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy h:mm a')
    } catch {
      return dateString
    }
  }
  
  // Only show to organization members
  if (!organization) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Organization Inactive</AlertTitle>
        <AlertDescription>
          Your organization is currently inactive. Reactivate to manage credits.
        </AlertDescription>
      </Alert>
    )
  }
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Credits</CardTitle>
        <CardDescription>Manage your organization credits</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center p-6">
            <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-gray-900"></div>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between rounded-lg bg-secondary p-4">
              <span className="text-sm font-medium">Current Balance</span>
              <span className="text-2xl font-bold" data-credit-balance>{credits} credits</span>
            </div>

            {!isActiveOrg && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Organization Inactive</AlertTitle>
                <AlertDescription>
                  Your organization is currently inactive. Reactivate to manage credits.
                </AlertDescription>
              </Alert>
            )}
            
            {transactions.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-2 text-sm font-medium">Transaction History</h3>
                <div className="space-y-2">
                  {transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <div>
                        <p className="font-medium">
                          {transaction.type === "add" ? "Added" : "Used"}{" "}
                          {transaction.amount} credits
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {transaction.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(transaction.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`text-sm font-medium ${
                          transaction.type === "add" ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {transaction.type === "add" ? "+" : "-"}
                        {transaction.amount}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <p className="text-xs text-muted-foreground">
          Credits can be used for premium features and services within the platform.
        </p>
      </CardFooter>
    </Card>
  )
} 