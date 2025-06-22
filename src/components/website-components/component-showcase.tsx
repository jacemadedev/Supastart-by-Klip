import { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

interface ComponentShowcaseProps {
    title: string
    description?: string
    children: ReactNode
    code?: string
}

export default function ComponentShowcase({ title, description, children, code }: ComponentShowcaseProps) {
    return (
        <Card className="w-full mb-8 overflow-hidden">
            <CardHeader>
                <CardTitle className="text-xl font-semibold">{title}</CardTitle>
                {description && <CardDescription>{description}</CardDescription>}
            </CardHeader>
            <CardContent className="pb-2">
                <div className="mb-6 overflow-hidden rounded-md border p-6">
                    {children}
                </div>
                {code && (
                    <div className="overflow-auto rounded-md bg-zinc-950 p-4">
                        <pre className="text-sm text-white">
                            <code>{code}</code>
                        </pre>
                    </div>
                )}
            </CardContent>
        </Card>
    )
} 