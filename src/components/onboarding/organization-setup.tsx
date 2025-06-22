import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Building2, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

type OrganizationSetupProps = {
  // Modal mode props
  isDialog?: boolean
  isOpen?: boolean
  // Common props
  title?: string
  description?: string
  returnPath?: string
}

// Event handler props are defined separately and used in the client component
interface ClientProps extends OrganizationSetupProps {
  onClose?: () => void
  onCreate: (name: string) => Promise<boolean>
  error?: string
}

export function OrganizationSetup({
  isDialog = false,
  isOpen = false,
  onClose = () => {},
  onCreate,
  title = "Welcome to SupaStart",
  description = "Let's set up your workspace",
  returnPath = "/dashboard",
  error
}: ClientProps) {
  const [step, setStep] = useState(1)
  const [orgName, setOrgName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setIsSubmitting(true)
    
    try {
      const success = await onCreate(orgName)
      if (success) {
        if (isDialog) {
          onClose()
        } else {
          router.push(returnPath)
        }
      }
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const content = (
    <>
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex justify-center p-4">
            <div className="bg-primary/10 p-6 rounded-full">
              <Building2 className="h-12 w-12 text-primary" />
            </div>
          </div>
          <h3 className="text-center font-medium text-lg">Create your organization</h3>
          <p className="text-center text-sm text-muted-foreground">
            Organizations help you organize your work and collaborate with team members.
          </p>
          <Button onClick={() => setStep(2)} className="w-full">
            Get Started
          </Button>
        </div>
      )}
      
      {step === 2 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org_name">Organization Name</Label>
            <Input 
              id="org_name" 
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="My Organization"
              autoFocus
              aria-invalid={error ? "true" : "false"}
            />
          </div>
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3 flex items-start">
              <span className="leading-tight">{error}</span>
            </div>
          )}
          <Button 
            onClick={() => handleSubmit()} 
            className="w-full"
            disabled={!orgName.trim() || isSubmitting}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Organization
          </Button>
        </div>
      )}
    </>
  )
  
  // Render as a dialog or standalone component
  if (isDialog) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    )
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  )
} 